import { defineMethod } from '../core'
import {
  DropUploadBeginRequestSchema,
  DropUploadChunkRequestSchema,
  DropUploadCommitRequestSchema
} from '../../../../shared/drop-upload-session-contract'
import { DropUploadSessionService } from '../../../files/drop-upload-session-service'

// Module-scoped rather than hung off the runtime object: a drop session needs
// nothing from the runtime, so threading it through the command contract would
// be surface for its own sake.
const dropUploads = new DropUploadSessionService()

export const DROP_UPLOAD_METHODS = [
  defineMethod({
    name: 'files.beginDrop',
    params: DropUploadBeginRequestSchema,
    handler: (params) => dropUploads.begin(params)
  }),
  defineMethod({
    name: 'files.uploadDropChunk',
    params: DropUploadChunkRequestSchema,
    handler: (params) => dropUploads.append(params.uploadId, params.offset, params.bytesBase64)
  }),
  defineMethod({
    name: 'files.commitDrop',
    params: DropUploadCommitRequestSchema,
    handler: (params) => dropUploads.commit(params.uploadId)
  })
]
