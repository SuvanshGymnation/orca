import { z } from 'zod'

export const DROP_UPLOAD_CHUNK_MAX_BYTES = 256 * 1024

/** Largest attachment a paired client may push. Bounded so a client cannot
 *  make the runtime hold an unbounded staging file. */
export const DROP_UPLOAD_MAX_BYTES = 64 * 1024 * 1024

export const DropUploadBeginRequestSchema = z
  .object({
    worktreePath: z.string().min(1),
    fileName: z.string().min(1).max(255),
    // Declared up front so an incomplete transfer cannot commit.
    bytes: z.number().int().nonnegative().max(DROP_UPLOAD_MAX_BYTES),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    transferId: z.string().min(1).max(128).optional()
  })
  .strict()

export const DropUploadBeginResultSchema = z.object({
  uploadId: z.string().min(1).max(128),
  chunkBytes: z.number().int().positive(),
  acknowledgedOffset: z.number().int().nonnegative()
})

export const DropUploadChunkRequestSchema = z
  .object({
    uploadId: z.string().min(1).max(128),
    offset: z.number().int().nonnegative(),
    bytesBase64: z.string().max(Math.ceil(DROP_UPLOAD_CHUNK_MAX_BYTES / 3) * 4 + 8)
  })
  .strict()

export const DropUploadCommitRequestSchema = z
  .object({ uploadId: z.string().min(1).max(128) })
  .strict()

export type DropUploadBeginRequest = z.infer<typeof DropUploadBeginRequestSchema>
export type DropUploadBeginResult = z.infer<typeof DropUploadBeginResultSchema>
export type DropUploadChunkRequest = z.infer<typeof DropUploadChunkRequestSchema>
export type DropUploadCommitRequest = z.infer<typeof DropUploadCommitRequestSchema>
