import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Messages typed while the agent is working, sent once it stops.
 *
 * DURABILITY: memory only. The renderer store has no persistence, so a reload,
 * crash or app restart drops anything still queued. A queued message that
 * vanishes is indistinguishable from one the agent ignored, so callers must
 * surface `queued` rather than letting it disappear quietly.
 */
export type NativeChatSendQueue = {
  queued: readonly string[]
  enqueue: (text: string) => void
  clear: () => void
}

export function useNativeChatSendQueue(args: {
  isWorking: boolean
  send: (text: string) => void
}): NativeChatSendQueue {
  const { isWorking, send } = args
  const [queued, setQueued] = useState<readonly string[]>([])
  const sendRef = useRef(send)
  sendRef.current = send

  const enqueue = useCallback((text: string) => {
    if (text.trim() === '') {
      return
    }
    setQueued((previous) => [...previous, text])
  }, [])

  const clear = useCallback(() => setQueued([]), [])

  useEffect(() => {
    if (isWorking || queued.length === 0) {
      return
    }
    // Why dispatch the whole queue rather than one per idle transition: the PTY
    // send queue already serialises writes per PTY, so FIFO dispatch preserves
    // order without waiting for another isWorking edge that may never come.
    const pending = queued
    setQueued([])
    for (const text of pending) {
      sendRef.current(text)
    }
  }, [isWorking, queued])

  return { queued, enqueue, clear }
}
