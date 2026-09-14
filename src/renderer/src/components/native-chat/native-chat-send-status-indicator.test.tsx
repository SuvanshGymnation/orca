// @vitest-environment happy-dom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { NativeChatComposerActions } from './NativeChatComposerActions'
import type { NativeChatSendStatus } from './use-native-chat-send-lifecycle'

function renderActions(sendStatus: NativeChatSendStatus): HTMLElement {
  return render(
    <TooltipProvider>
      <NativeChatComposerActions
        attachDisabled={false}
        dictationDisabled
        sendDisabled={false}
        sendStatus={sendStatus}
        isWorking={false}
        isDictating={false}
        isDictationHoldMode={false}
        onAttach={() => {}}
        onDictationToggle={() => {}}
        onDictationHoldStart={() => {}}
        onDictationHoldEnd={() => {}}
        onSend={() => {}}
        sessionOptionsSurface={null}
        sessionOptionsSnapshot={[]}
      />
    </TooltipProvider>
  ).container
}

describe('send status indicator', () => {
  it('shows nothing while idle', () => {
    const c = renderActions('idle')
    expect(c.querySelector('[data-native-chat-send-status]')).toBeNull()
  })

  // The visible half of the bug: without this element he cannot tell a send
  // that failed from one that silently did nothing.
  it('renders a failed state he can see', () => {
    const c = renderActions('failed')
    const el = c.querySelector('[data-native-chat-send-status]')
    expect(el?.getAttribute('data-native-chat-send-status')).toBe('failed')
    expect(el?.textContent).toBe('Not sent')
  })

  it('renders pending and submitted distinctly', () => {
    const c = renderActions('pending')
    expect(c.querySelector('[data-native-chat-send-status]')?.textContent).toBe('Sending…')
  })
})
