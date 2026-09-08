import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BUTTON_BLOCK_SLUG } from './lexical.js'
import { lexicalToReact } from './lexical-react.js'

/**
 * The copyable link a button repeats underneath itself. It exists for the reader whose client
 * stripped the link or who is reading the plain-text part, so what matters is that the resolved URL
 * appears as text and that turning it off leaves nothing behind.
 */

const URL_TOKEN = '{{url}}'
const RESOLVED = 'https://example.com/auth/verify-email?token=abc123'

function buttonState(fields: Record<string, unknown>): SerializedEditorState {
  return {
    root: {
      children: [{ fields: { blockType: BUTTON_BLOCK_SLUG, ...fields }, type: 'block' }],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as unknown as SerializedEditorState
}

function html(fields: Record<string, unknown>): string {
  const tree = lexicalToReact(buttonState(fields), { variables: { url: RESOLVED } })

  return renderToStaticMarkup(createElement(Fragment, null, tree))
}

describe('button fallback link', () => {
  it('repeats the resolved url as plain text under the button', () => {
    const output = html({ label: 'Verify email address', url: URL_TOKEN, fallbackText: 'Paste this link:' })

    expect(output).toContain('Paste this link:')
    // Once as the button href, once as text nobody has to click.
    expect(output.split(RESOLVED)).toHaveLength(3)
    expect(output).toContain('pe-fine')
  })

  it('is left out when the block turns it off', () => {
    const output = html({ fallback: false, label: 'Open your dashboard', url: URL_TOKEN, fallbackText: 'Paste this link:' })

    expect(output).not.toContain('Paste this link:')
    expect(output).not.toContain('pe-fine')
    expect(output.split(RESOLVED)).toHaveLength(2)
  })

  it('shows the bare link when the sentence is cleared', () => {
    const output = html({ fallbackText: '', label: 'Verify', url: URL_TOKEN })

    expect(output).toContain('pe-fine')
    expect(output.split(RESOLVED)).toHaveLength(3)
  })

  it('renders nothing extra for a button without a url', () => {
    const output = html({ label: 'Verify', url: '' })

    expect(output).not.toContain('pe-fine')
  })

  it('resolves variables inside the sentence too', () => {
    const tree = lexicalToReact(buttonState({ fallbackText: 'Open {{site.name}} by hand:', label: 'Go', url: URL_TOKEN }), {
      variables: { 'site.name': 'Ridgeline', url: RESOLVED },
    })

    expect(renderToStaticMarkup(createElement(Fragment, null, tree))).toContain('Open Ridgeline by hand:')
  })
})
