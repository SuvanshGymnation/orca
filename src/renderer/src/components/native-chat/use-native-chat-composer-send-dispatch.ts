import { useCallback } from 'react'
import type { NativeChatSendQueue } from './use-native-chat-send-queue'

type ImageAttachment = { path: string; pending?: boolean }

/** Chooses between sending now, queueing for later, and refusing outright. */
export function useNativeChatComposerSendDispatch(args: {
  draft: string
  disabled: boolean
  hasPendingAttachment: boolean
  imageAttachments: readonly ImageAttachment[]
  isWorking: boolean
  sendQueue: NativeChatSendQueue
  clearDraft: () => void
  sendPty: (queuedText?: string) => void
  sendStructured: (text: string, images: readonly ImageAttachment[]) => void
  structuredTransport: boolean
}): () => void {
  const {
    draft,
    disabled,
    hasPendingAttachment,
    imageAttachments,
    isWorking,
    sendQueue,
    clearDraft,
    sendPty,
    sendStructured,
    structuredTransport
  } = args
  return useCallback(() => {
    if (hasPendingAttachment) {
      return
    }
    // Why queue rather than refuse: the send button is a Stop button while the
    // agent runs, so the message previously had nowhere to go.
    if (isWorking) {
      if (draft.trim() === '') {
        return
      }
      sendQueue.enqueue(draft)
      clearDraft()
      return
    }
    if (!structuredTransport) {
      sendPty()
      return
    }
    if ((draft.trim() !== '' || imageAttachments.length > 0) && !disabled) {
      sendStructured(draft, imageAttachments)
    }
  }, [
    disabled,
    draft,
    hasPendingAttachment,
    imageAttachments,
    isWorking,
    sendQueue,
    clearDraft,
    sendPty,
    sendStructured,
    structuredTransport
  ])
}
