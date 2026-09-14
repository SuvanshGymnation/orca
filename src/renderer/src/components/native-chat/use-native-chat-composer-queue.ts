import { useNativeChatSendQueue, type NativeChatSendQueue } from './use-native-chat-send-queue'

/** Routes a queued drain to whichever transport the composer is using. */
export function useNativeChatComposerQueue(args: {
  isWorking: boolean
  structuredTransport: boolean
  sendPty: (queuedText?: string) => void
  sendStructured: (text: string, images: readonly never[]) => void
}): NativeChatSendQueue {
  const { isWorking, structuredTransport, sendPty, sendStructured } = args
  return useNativeChatSendQueue({
    isWorking,
    send: (queuedText) => {
      if (structuredTransport) {
        sendStructured(queuedText, [])
        return
      }
      sendPty(queuedText)
    }
  })
}
