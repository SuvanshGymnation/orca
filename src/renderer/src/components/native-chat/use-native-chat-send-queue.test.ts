// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNativeChatSendQueue } from './use-native-chat-send-queue'

describe('native chat send queue', () => {
  it('holds messages while the agent is working and sends none', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useNativeChatSendQueue({ isWorking: true, send }))

    act(() => result.current.enqueue('first'))
    act(() => result.current.enqueue('second'))

    expect(send).not.toHaveBeenCalled()
    expect(result.current.queued).toEqual(['first', 'second'])
  })

  it('drains in the order sent once work ends', () => {
    const send = vi.fn()
    const { result, rerender } = renderHook(
      ({ isWorking }) => useNativeChatSendQueue({ isWorking, send }),
      { initialProps: { isWorking: true } }
    )

    act(() => result.current.enqueue('first'))
    act(() => result.current.enqueue('second'))
    act(() => rerender({ isWorking: false }))

    expect(send.mock.calls.map((call) => call[0])).toEqual(['first', 'second'])
    expect(result.current.queued).toEqual([])
  })

  it('does not queue blank input', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useNativeChatSendQueue({ isWorking: true, send }))

    act(() => result.current.enqueue('   '))

    expect(result.current.queued).toEqual([])
  })

  // Documents the limit rather than implying a guarantee: a remount is the
  // closest observable stand-in for the reload that drops the queue.
  it('starts empty on remount - the queue does not survive', () => {
    const send = vi.fn()
    const first = renderHook(() => useNativeChatSendQueue({ isWorking: true, send }))
    act(() => first.result.current.enqueue('lost on reload'))
    expect(first.result.current.queued).toEqual(['lost on reload'])
    first.unmount()

    const second = renderHook(() => useNativeChatSendQueue({ isWorking: true, send }))
    expect(second.result.current.queued).toEqual([])
  })
})
