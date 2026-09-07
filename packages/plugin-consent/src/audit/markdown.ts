import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { Payload } from 'payload'

import { legalPagesEditor } from '../collections/legal-pages.js'
import { markdownToLegalContent } from '../seed/legal.js'

export { markdownToLegalContent }

/**
 * The agent's edit format is markdown, not Lexical JSON.
 *
 * The seed templates are already markdown with `{{cookie-table}}`-style tokens, and the legal
 * pages editor already registers the markdown transformer that turns GFM tables into real
 * table nodes. Reusing both means the agent reads and writes exactly the format the seeds are
 * written in — no second converter to keep in step, and no model asked to emit Lexical JSON,
 * which it will do plausibly and wrongly.
 */
export const TOKENS = {
  cookieTable: '{{cookie-table}}',
  policyVersion: '{{policy-version}}',
} as const

const PROCESSOR_MODES = ['recipients', 'transfers', 'subprocessors', 'annex', 'changes'] as const
export type ProcessorTableMode = (typeof PROCESSOR_MODES)[number]

/** Any `{{…}}` token, valid or not — used to catch tokens that were never converted to blocks. */
export const ANY_TOKEN = /\{\{\s*([a-z-]+(?::[a-z-]+)?)\s*\}\}/gi

export function isKnownToken(token: string): boolean {
  const normalised = token.trim()
  if (normalised === 'cookie-table' || normalised === 'policy-version') return true
  const [name, mode] = normalised.split(':')
  return name === 'processor-table' && PROCESSOR_MODES.includes(mode as ProcessorTableMode)
}

type LexicalNode = Record<string, any>

function textNode(text: string): LexicalNode {
  return { type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }
}

function paragraph(text: string): LexicalNode {
  return { type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, textFormat: 0, children: [textNode(text)] }
}

/** The token a block node is written back as. */
export function tokenForBlock(node: LexicalNode): string | null {
  if (node?.type !== 'block') return null
  const fields = (node.fields ?? {}) as Record<string, unknown>
  switch (fields.blockType) {
    case 'cookieTable':
      return TOKENS.cookieTable
    case 'policyVersion':
      return TOKENS.policyVersion
    case 'processorTable':
      return `{{processor-table:${String(fields.mode ?? 'recipients')}}}`
    default:
      return null
  }
}

function replaceBlocks(node: LexicalNode): LexicalNode {
  const token = tokenForBlock(node)
  if (token) return paragraph(token)
  if (Array.isArray(node?.children)) {
    return { ...node, children: node.children.map((child: LexicalNode) => replaceBlocks(child)) }
  }
  return node
}

/** Walks an editor state and reports which plugin blocks it contains, as tokens. */
export function blockTokensIn(content: unknown): string[] {
  const tokens: string[] = []
  const visit = (node: LexicalNode) => {
    if (!node || typeof node !== 'object') return
    const token = tokenForBlock(node)
    if (token) tokens.push(token)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  const root = (content as { root?: LexicalNode } | null)?.root
  if (root) visit(root)
  return tokens
}

/**
 * Lexical → markdown, with the plugin's blocks written back as the tokens the seeds use.
 * The inverse of `markdownToLegalContent`, so a page can be read, edited and written back
 * without the round trip losing a table or inventing one.
 */
export async function legalContentToMarkdown(payload: Payload, content: unknown): Promise<string> {
  if (!content || typeof content !== 'object') return ''
  const editorConfig = await editorConfigFactory.fromEditor({ config: payload.config, editor: legalPagesEditor() })
  const source = content as { root: LexicalNode }
  const data = { ...source, root: replaceBlocks(source.root) }
  return convertLexicalToMarkdown({ data: data as never, editorConfig })
}

/** Plain text of a page, for prose checks that should not trip over markdown syntax. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[>#\-*|\s]+/gm, ' ')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tokens sitting in the stored content as literal *text* rather than as blocks.
 *
 * This is the difference between a page that renders the live cookie table and a page that
 * shows visitors the string `{{cookie-table}}`. It is checked against the editor state, not
 * against the markdown, because writing a page back to markdown deliberately reproduces the
 * tokens for every block it does contain.
 */
export function unresolvedTokensIn(content: unknown): string[] {
  const found = new Set<string>()
  const visit = (node: LexicalNode) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'text' && typeof node.text === 'string') {
      for (const match of node.text.matchAll(ANY_TOKEN)) found.add(match[0])
    }
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  const root = (content as { root?: LexicalNode } | null)?.root
  if (root) visit(root)
  return [...found]
}

/** Tokens in agent-authored markdown that the converter would not turn into a block. */
export function invalidTokens(markdown: string): string[] {
  const found = new Set<string>()
  for (const match of markdown.matchAll(ANY_TOKEN)) {
    if (!isKnownToken(match[1])) found.add(match[0])
  }
  return [...found]
}
