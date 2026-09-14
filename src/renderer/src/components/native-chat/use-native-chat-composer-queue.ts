import { useNativeChatSendQueue, type NativeChatSendQueue } from './use-native-chat-send-queue'
import type {
  NativeChatComposerImageAttachment,
  NativeChatStructuredComposerTransport
} from './native-chat-composer-types'

/** Routes a queued drain to whichever transport the composer is using. */
export function useNativeChatComposerQueue(args: {
  isWorking: boolean
  structuredTransport: NativeChatStructuredComposerTransport | undefined
  sendPty: (queuedText?: string) => void
  sendStructured: (text: string, attachments?: readonly NativeChatComposerImageAttachment[]) => void
}): NativeChatSendQueue {
  const { isWorking, structuredTransport, sendPty, sendStructured } = args
  return useNativeChatSendQueue({
    isWorking,
    send: (queuedText) => {
      if (structuredTransport) {
        sendStructured(queuedText)
        return
      }
      sendPty(queuedText)
    }
  })
}
