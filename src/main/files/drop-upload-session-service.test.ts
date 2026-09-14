import { createHash } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DropUploadSessionService } from './drop-upload-session-service'

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

let worktreePath: string
let service: DropUploadSessionService

beforeEach(async () => {
  worktreePath = await mkdtemp(join(tmpdir(), 'orca-drop-'))
  service = new DropUploadSessionService()
})

function begin(payload: Buffer, fileName = 'note.txt', bytes = payload.length): string {
  return service.begin({ worktreePath, fileName, bytes, sha256: sha(payload) }).uploadId
}

describe('paired drop upload', () => {
  it('writes the file into .orca/drops and returns its path', async () => {
    const payload = Buffer.from('hello from a phone')
    const uploadId = begin(payload)
    service.append(uploadId, 0, payload.toString('base64'))

    const { path } = await service.commit(uploadId)

    expect(path).toBe(join(worktreePath, '.orca', 'drops', 'note.txt'))
    expect(await readFile(path)).toEqual(payload)
  })

  // A truncated transfer that committed would put a file on disk that the
  // message already claimed to attach. This is the failure the declared size
  // exists to make impossible.
  it('refuses to commit a truncated transfer', async () => {
    const payload = Buffer.from('0123456789')
    const uploadId = begin(payload)
    service.append(uploadId, 0, payload.subarray(0, 4).toString('base64'))

    await expect(service.commit(uploadId)).rejects.toThrow('drop-upload-incomplete')
  })

  it('refuses to commit when the bytes do not match the declared digest', async () => {
    const declared = Buffer.from('the real bytes')
    const uploadId = service.begin({
      worktreePath,
      fileName: 'note.txt',
      bytes: declared.length,
      sha256: sha(Buffer.from('different bytes'))
    }).uploadId
    service.append(uploadId, 0, declared.toString('base64'))

    await expect(service.commit(uploadId)).rejects.toThrow('drop-upload-digest-mismatch')
  })

  // A gap would be zero-filled silently, leaving the digest as the only thing
  // able to notice - at commit, after the client believed the bytes landed.
  it('rejects a chunk that does not continue from the acknowledged offset', () => {
    const payload = Buffer.from('0123456789')
    const uploadId = begin(payload)

    expect(() => service.append(uploadId, 4, payload.toString('base64'))).toThrow(
      'drop-upload-offset-mismatch'
    )
  })

  it('rejects bytes beyond the declared size', () => {
    const payload = Buffer.from('0123456789')
    const uploadId = begin(payload, 'note.txt', 4)

    expect(() => service.append(uploadId, 0, payload.toString('base64'))).toThrow(
      'drop-upload-exceeds-declared-size'
    )
  })

  // fileName comes from a remote client and is untrusted.
  it('refuses a file name that would escape the drop directory', () => {
    expect(() =>
      service.begin({
        worktreePath,
        fileName: '../escaped.txt',
        bytes: 1,
        sha256: sha(Buffer.from('x'))
      })
    ).toThrow('drop-upload-unsafe-file-name')
  })

  it('refuses an unknown session', () => {
    expect(() => service.append('nope', 0, '')).toThrow('drop-upload-unknown-session')
  })
})
