// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNativeChatSendLifecycle } from './use-native-chat-send-lifecycle'
import type { NativeChatSendHandle } from './native-chat-runtime-send'

// No cast: a fixture asserted into the shape the code wants cannot detect that
// the real shape differs, which is exactly how `finished()` survived review.
function settlingHandle(settled: Promise<void>): NativeChatSendHandle {
  return { cancel: () => {}, settleAfterMs: 0, settled }
}

/** Mirrors sendNativeChatAskAnswer, which reports no completion at all. */
function silentHandle(): NativeChatSendHandle {
  return { cancel: () => {}, settleAfterMs: 0 }
}

describe('native chat send status', () => {
  it('reports pending then submitted for a handle that settles', async () => {
    let resolve = (): void => {}
    const settled = new Promise<void>((r) => (resolve = r))
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    act(() => result.current.trackPendingSend(settlingHandle(settled)))
    expect(result.current.sendStatus).toBe('pending')

    await act(async () => {
      resolve()
      await settled
    })
    expect(result.current.sendStatus).toBe('submitted')
  })

  // A handle with no `settled` cannot report completion, so claiming one would
  // be the false reassurance this work exists to remove.
  it('claims nothing for a handle that reports no completion', () => {
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    act(() => result.current.trackPendingSend(silentHandle()))

    expect(result.current.sendStatus).toBe('idle')
  })

  it('reports failed when a pending send is cancelled before it settles', () => {
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    act(() => result.current.trackPendingSend(settlingHandle(new Promise<void>(() => {}))))
    expect(result.current.sendStatus).toBe('pending')

    act(() => result.current.cancelPendingSends())
    expect(result.current.sendStatus).toBe('failed')
  })

  // The verified path reports acceptance as a boolean, not a handle. Without
  // it, "submitted" only ever meant we called a function.
  it('reports submitted when the runtime accepted the bytes', async () => {
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    await act(async () => {
      result.current.trackVerifiedSend(Promise.resolve(true))
    })

    expect(result.current.sendStatus).toBe('submitted')
  })

  it('reports failed when the runtime did NOT accept the bytes', async () => {
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    await act(async () => {
      result.current.trackVerifiedSend(Promise.resolve(false))
    })

    expect(result.current.sendStatus).toBe('failed')
  })

  it('reports failed when the verified send throws', async () => {
    const { result } = renderHook(() => useNativeChatSendLifecycle('tab', 'pty'))

    await act(async () => {
      result.current.trackVerifiedSend(Promise.reject(new Error('pty gone')))
    })

    expect(result.current.sendStatus).toBe('failed')
  })
})
