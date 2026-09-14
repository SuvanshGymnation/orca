import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { NativeChatSendHandle } from './native-chat-runtime-send'

/** Derived only from what NativeChatSendHandle actually exposes. A handle with
 *  no `settled` (the ask-answer no-op) reports nothing, so it never enters
 *  `pending` rather than being given a completion it cannot observe. */
export type NativeChatSendStatus = 'idle' | 'pending' | 'submitted' | 'failed'

export type NativeChatSendLifecycle = {
  cancelPendingSends: () => void
  trackPendingSend: (handle: NativeChatSendHandle, pendingId?: string) => void
  sendStatus: NativeChatSendStatus
}

export function useNativeChatSendLifecycle(
  terminalTabId: string,
  targetPtyId: string | null,
  onPendingSendCanceled?: (pendingId: string) => void
): NativeChatSendLifecycle {
  const [sendStatus, setSendStatus] = useState<NativeChatSendStatus>('idle')
  const pendingSendHandlesRef = useRef(
    new Map<
      NativeChatSendHandle,
      { cleanupTimer: ReturnType<typeof setTimeout> | null; pendingId?: string }
    >()
  )
  const cancelPendingSends = useCallback(() => {
    for (const [handle, entry] of pendingSendHandlesRef.current) {
      const { cleanupTimer, pendingId } = entry
      if (cleanupTimer !== null) {
        clearTimeout(cleanupTimer)
      }
      handle.cancel()
      if (pendingId) {
        onPendingSendCanceled?.(pendingId)
      }
    }
    if (pendingSendHandlesRef.current.size > 0) {
      setSendStatus('failed')
    }
    pendingSendHandlesRef.current.clear()
  }, [onPendingSendCanceled])
  const trackPendingSend = useCallback((handle: NativeChatSendHandle, pendingId?: string) => {
    const entry = {
      cleanupTimer: null as ReturnType<typeof setTimeout> | null,
      ...(pendingId ? { pendingId } : {})
    }
    pendingSendHandlesRef.current.set(handle, entry)
    if (handle.settled) {
      setSendStatus('pending')
      void handle.settled.then(() => {
        if (pendingSendHandlesRef.current.get(handle) === entry) {
          setSendStatus('submitted')
          pendingSendHandlesRef.current.delete(handle)
        }
      })
      return
    }
    entry.cleanupTimer = setTimeout(() => {
      pendingSendHandlesRef.current.delete(handle)
    }, handle.settleAfterMs)
  }, [])

  // Why: delayed Enter/image writes belong to the exact PTY target. A pane
  // swap or unmount must cancel them before that PTY can close or be reused.
  useLayoutEffect(() => cancelPendingSends, [cancelPendingSends, targetPtyId, terminalTabId])

  return { cancelPendingSends, trackPendingSend, sendStatus }
}
