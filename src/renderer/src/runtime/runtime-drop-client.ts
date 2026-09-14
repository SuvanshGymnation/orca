import {
  DROP_UPLOAD_CHUNK_MAX_BYTES,
  type DropUploadBeginResult
} from '../../../shared/drop-upload-session-contract'
import { callRuntimeRpc, type RuntimeClientTarget } from './runtime-rpc-client'

const DROP_UPLOAD_TIMEOUT_MS = 60_000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Push one attachment from a paired client into `${worktreePath}/.orca/drops`
 * and return the path the agent can read.
 *
 * A paired client has no filesystem bridge - window.api.fs is an Electron
 * preload API it does not have - so the bytes can only reach the worktree over
 * the runtime RPC. Rejects rather than resolving on any failure: the caller
 * must not be able to report a send for a file that did not land.
 */
export async function uploadRuntimeDrop(
  target: RuntimeClientTarget,
  args: { worktreePath: string; fileName: string; bytes: Uint8Array }
): Promise<string> {
  const sha256 = await sha256Hex(args.bytes)
  const begin = await callRuntimeRpc<DropUploadBeginResult>(
    target,
    'files.beginDrop',
    {
      worktreePath: args.worktreePath,
      fileName: args.fileName,
      bytes: args.bytes.length,
      sha256
    },
    { timeoutMs: DROP_UPLOAD_TIMEOUT_MS }
  )

  const chunkBytes = Math.min(
    begin.chunkBytes || DROP_UPLOAD_CHUNK_MAX_BYTES,
    DROP_UPLOAD_CHUNK_MAX_BYTES
  )
  for (let offset = begin.acknowledgedOffset; offset < args.bytes.length; offset += chunkBytes) {
    const slice = args.bytes.subarray(offset, Math.min(offset + chunkBytes, args.bytes.length))
    await callRuntimeRpc<{ acknowledgedOffset: number }>(
      target,
      'files.uploadDropChunk',
      { uploadId: begin.uploadId, offset, bytesBase64: toBase64(slice) },
      { timeoutMs: DROP_UPLOAD_TIMEOUT_MS }
    )
  }

  // The runtime verifies the declared size and digest here. An incomplete or
  // corrupted transfer throws instead of returning a path.
  const committed = await callRuntimeRpc<{ path: string }>(
    target,
    'files.commitDrop',
    { uploadId: begin.uploadId },
    { timeoutMs: DROP_UPLOAD_TIMEOUT_MS }
  )
  return committed.path
}
