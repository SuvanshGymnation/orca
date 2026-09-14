// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNativeChatSendLifecycle } from './use-native-chat-send-lifecycle'
import type { NativeChatSendHandle } from './native-chat-runtime-send'

function handle(finished: boolean, settled: Promise<void>): NativeChatSendHandle {
  return {
    cancel: () => {},
    settleAfterMs: 0,
    settled,
    bodyStarted: () => true,
    finished: () => finished
  } as NativeChatSendHandle
}

describe('native chat send status', () => {
  it('reports submitted when the send finished', async () => {
    let resolve = (): void => {}
    const settled = new Promise<void>((r) => (resolve = r))
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    act(() => result.current.trackPendingSend(handle(true, settled)))
    expect(result.current.sendStatus).toBe('pending')

    await act(async () => {
      resolve()
      await settled
    })
    expect(result.current.sendStatus).toBe('submitted')
  })

  // The bug: a send that settles without finishing is silently indistinguishable
  // from one that worked. Without a failed state this assertion cannot be written.
  it('reports failed when the send settled without finishing', async () => {
    let resolve = (): void => {}
    const settled = new Promise<void>((r) => (resolve = r))
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    act(() => result.current.trackPendingSend(handle(false, settled)))

    await act(async () => {
      resolve()
      await settled
    })
    expect(result.current.sendStatus).toBe('failed')
  })

  it('reports failed when a tracked send is cancelled before submitting', () => {
    const settled = new Promise<void>(() => {})
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    act(() => result.current.trackPendingSend(handle(false, settled)))
    act(() => result.current.cancelPendingSends())

    expect(result.current.sendStatus).toBe('failed')
  })
})
