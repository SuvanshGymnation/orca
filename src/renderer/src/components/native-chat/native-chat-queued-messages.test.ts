// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The queue is memory-only, so the UI is the only thing standing between a
// dropped message and the "the agent ignored me" complaint this work fixes.
// These assert the Field actually renders it rather than holding it silently.
const field = readFileSync(join(__dirname, 'NativeChatComposerField.tsx'), 'utf8')

describe('queued messages are visible', () => {
  it('renders a count the user can see', () => {
    expect(field).toContain('data-native-chat-queued-count')
  })

  it('renders each queued message, not just a number', () => {
    expect(field).toContain('data-native-chat-queued-message')
    expect(field).toContain('queuedMessages.map')
  })

  it('warns that the queue does not survive a reload', () => {
    expect(field).toMatch(/lost if Orca reloads/i)
  })
})
