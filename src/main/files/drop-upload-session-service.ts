import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import {
  DROP_UPLOAD_CHUNK_MAX_BYTES,
  type DropUploadBeginRequest,
  type DropUploadBeginResult
} from '../../shared/drop-upload-session-contract'

type DropSession = {
  uploadId: string
  worktreePath: string
  fileName: string
  bytes: number
  sha256: string
  received: Buffer[]
  bytesReceived: number
}

/**
 * Staging for attachments pushed by a PAIRED client.
 *
 * This exists because neither existing drop branch covers the direction: a
 * local worktree references paths in place, and the SSH branch pushes from the
 * Orca host outward. Here the bytes are on a phone or web client with no
 * filesystem bridge at all, so they can only arrive over the pairing RPC.
 *
 * It deliberately does not reuse SkillUploadSessionService: that validates a
 * package record (compressedBytes, archiveSha256) and carries staging
 * ownership, retention and archive extraction, none of which an arbitrary file
 * has or needs. The integrity MODEL is what carries over - a declared size and
 * digest at begin, so an incomplete or corrupted transfer cannot commit.
 */
export class DropUploadSessionService {
  private readonly sessions = new Map<string, DropSession>()

  begin(request: DropUploadBeginRequest): DropUploadBeginResult {
    assertSafeFileName(request.fileName)
    const uploadId = randomUUID()
    this.sessions.set(uploadId, {
      uploadId,
      worktreePath: request.worktreePath,
      fileName: request.fileName,
      bytes: request.bytes,
      sha256: request.sha256,
      received: [],
      bytesReceived: 0
    })
    return { uploadId, chunkBytes: DROP_UPLOAD_CHUNK_MAX_BYTES, acknowledgedOffset: 0 }
  }

  append(uploadId: string, offset: number, bytesBase64: string): { acknowledgedOffset: number } {
    const session = this.require(uploadId)
    // Why reject rather than seek: a gap would be silently zero-filled, leaving
    // the digest as the only thing able to catch it - at commit, long after the
    // client believed the bytes had landed.
    if (offset !== session.bytesReceived) {
      throw new Error('drop-upload-offset-mismatch')
    }
    const chunk = Buffer.from(bytesBase64, 'base64')
    if (chunk.length > DROP_UPLOAD_CHUNK_MAX_BYTES) {
      throw new Error('drop-upload-chunk-too-large')
    }
    if (session.bytesReceived + chunk.length > session.bytes) {
      throw new Error('drop-upload-exceeds-declared-size')
    }
    session.received.push(chunk)
    session.bytesReceived += chunk.length
    return { acknowledgedOffset: session.bytesReceived }
  }

  async commit(uploadId: string): Promise<{ path: string }> {
    const session = this.require(uploadId)
    if (session.bytesReceived !== session.bytes) {
      throw new Error('drop-upload-incomplete')
    }
    const payload = Buffer.concat(session.received)
    if (createHash('sha256').update(payload).digest('hex') !== session.sha256) {
      throw new Error('drop-upload-digest-mismatch')
    }
    const destDir = join(session.worktreePath.replace(/[\\/]+$/, ''), '.orca', 'drops')
    const destPath = join(destDir, session.fileName)
    assertInsideDropDir(destDir, destPath)
    await mkdir(destDir, { recursive: true })
    await writeFile(destPath, payload)
    this.sessions.delete(uploadId)
    return { path: destPath }
  }

  abort(uploadId: string): void {
    this.sessions.delete(uploadId)
  }

  private require(uploadId: string): DropSession {
    const session = this.sessions.get(uploadId)
    if (!session) {
      throw new Error('drop-upload-unknown-session')
    }
    return session
  }
}

function assertSafeFileName(fileName: string): void {
  // A paired client is remote, so its fileName is untrusted input.
  if (fileName !== basename(fileName) || fileName === '.' || fileName === '..') {
    throw new Error('drop-upload-unsafe-file-name')
  }
}

function assertInsideDropDir(destDir: string, destPath: string): void {
  const root = resolve(destDir)
  if (!resolve(destPath).startsWith(root + sep)) {
    throw new Error('drop-upload-escapes-drop-dir')
  }
}
