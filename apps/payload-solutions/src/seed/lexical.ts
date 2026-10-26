/**
 * A tiny builder for Lexical rich text, so seeded content (case studies) can be written as
 * readable code instead of hand-typed node JSON. Inline text understands two markdown marks:
 * `**bold**` and `[label](https://url)`. Everything an editor changes later happens in the
 * admin; this only produces the first version.
 */

type Node = Record<string, unknown>

const block = { format: '', indent: 0, version: 1, direction: 'ltr' as const }

function textNode(text: string, bold = false): Node {
  return { type: 'text', text, format: bold ? 1 : 0, style: '', mode: 'normal', detail: 0, version: 1 }
}

/** Splits `**bold**` and `[label](url)` out of a line into text and link nodes. */
export function inline(source: string): Node[] {
  const out: Node[] = []
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) out.push(textNode(source.slice(last, match.index)))
    if (match[1]) out.push(textNode(match[1], true))
    else
      out.push({
        ...block,
        type: 'link',
        version: 3,
        fields: { linkType: 'custom', url: match[3], newTab: true },
        children: [textNode(match[2] ?? '')],
      })
    last = match.index + match[0].length
  }
  if (last < source.length) out.push(textNode(source.slice(last)))
  return out
}

export const h2 = (text: string): Node => ({ ...block, type: 'heading', tag: 'h2', children: inline(text) })
export const h3 = (text: string): Node => ({ ...block, type: 'heading', tag: 'h3', children: inline(text) })
export const p = (text: string): Node => ({
  ...block,
  type: 'paragraph',
  textFormat: 0,
  textStyle: '',
  children: inline(text),
})
export const quote = (text: string): Node => ({ ...block, type: 'quote', children: inline(text) })
export const ul = (...items: string[]): Node => ({
  ...block,
  type: 'list',
  listType: 'bullet',
  tag: 'ul',
  start: 1,
  children: items.map((item, i) => ({ ...block, type: 'listitem', value: i + 1, children: inline(item) })),
})

export function richText(...children: Node[]) {
  return { root: { ...block, type: 'root', children } }
}
