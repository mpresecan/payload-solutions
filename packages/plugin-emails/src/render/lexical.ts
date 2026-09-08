import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'

export const BUTTON_BLOCK_SLUG = 'button'

type AnyNode = { [key: string]: unknown; children?: AnyNode[]; fields?: Record<string, unknown>; text?: string; type: string } & SerializedLexicalNode

const INLINE_TYPES = new Set(['autolink', 'link', 'text', 'linebreak', 'tab'])

function inlineText(node: AnyNode): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }
  if (node.type === 'linebreak') {
    return '\n'
  }
  return (node.children ?? []).map(inlineText).join('')
}

/**
 * Every string an editor could have typed a token into: one entry per block-level run of text
 * (so tokens split across formatting runs are still seen whole), plus link URLs and block fields.
 */
export function collectTemplateStrings(data: null | SerializedEditorState | undefined): string[] {
  const out: string[] = []
  const walk = (node: AnyNode): void => {
    if (node.type === 'block' || node.type === 'inlineBlock') {
      for (const value of Object.values(node.fields ?? {})) {
        if (typeof value === 'string') {
          out.push(value)
        }
      }
      return
    }
    if (node.type === 'link' || node.type === 'autolink') {
      const url = node.fields?.url
      if (typeof url === 'string') {
        out.push(url)
      }
    }
    const children = node.children ?? []
    const hasInlineChildren = children.some((c) => INLINE_TYPES.has(c.type))
    if (hasInlineChildren) {
      out.push(children.map(inlineText).join(''))
    }
    for (const child of children) {
      if (!INLINE_TYPES.has(child.type)) {
        walk(child)
      } else if (child.type === 'link' || child.type === 'autolink') {
        walk(child)
      }
    }
  }
  const root = data?.root as AnyNode | undefined
  if (root) {
    walk(root)
  }
  return out
}

/**
 * The same strings, but one entry per individual text run. A token present in the joined text of a
 * block but in none of its runs was split by formatting (`{{user.` **`name}}`**) — it would never
 * resolve at send time, so the collection rejects it on save.
 */
export function collectNodeStrings(data: null | SerializedEditorState | undefined): string[] {
  const out: string[] = []
  const walk = (node: AnyNode): void => {
    if (node.type === 'text' && typeof node.text === 'string') {
      out.push(node.text)
    }
    if (node.type === 'block' || node.type === 'inlineBlock') {
      for (const value of Object.values(node.fields ?? {})) {
        if (typeof value === 'string') {
          out.push(value)
        }
      }
      return
    }
    if ((node.type === 'link' || node.type === 'autolink') && typeof node.fields?.url === 'string') {
      out.push(node.fields.url)
    }
    for (const child of node.children ?? []) {
      walk(child)
    }
  }
  const root = data?.root as AnyNode | undefined
  if (root) {
    walk(root)
  }
  return out
}
