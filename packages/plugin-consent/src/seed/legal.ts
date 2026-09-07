import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { Payload, TypedLocale } from 'payload'

import { lexicalBlockNode } from '../blocks.js'
import { legalPagesEditor } from '../collections/legal-pages.js'
import type { CompanyInfo, ResolvedConsentPluginOptions, SeedOptions } from '../types.js'
import { cookiePolicyMarkdown } from './templates/cookies.js'
import { privacyPolicyMarkdown } from './templates/privacy.js'
import { termsOfServiceMarkdown } from './templates/terms.js'

export const COOKIE_TABLE_MARKER = '{{cookie-table}}'
export const POLICY_VERSION_MARKER = '{{policy-version}}'

type Doc = { kind: 'privacy' | 'terms' | 'cookies'; slug: string; title: string; markdown: string }

export function buildLegalDocuments(company: CompanyInfo, effectiveDate: string, which: Array<Doc['kind']>): Doc[] {
  const docs: Doc[] = [
    { kind: 'privacy', slug: 'privacy', title: 'Privacy Policy', markdown: privacyPolicyMarkdown(company, effectiveDate) },
    { kind: 'terms', slug: 'terms', title: 'Terms of Service', markdown: termsOfServiceMarkdown(company, effectiveDate) },
    { kind: 'cookies', slug: 'cookies', title: 'Cookie Policy', markdown: cookiePolicyMarkdown(company, effectiveDate) },
  ]
  return docs.filter((d) => which.includes(d.kind))
}

/**
 * Converts markdown to a Lexical editor state and swaps marker paragraphs for the plugin's blocks.
 */
export async function markdownToLegalContent(payload: Payload, markdown: string) {
  const editorConfig = await editorConfigFactory.fromEditor({ config: payload.config, editor: legalPagesEditor() })
  const state = convertMarkdownToLexical({ editorConfig, markdown }) as { root: { children: Array<Record<string, unknown>> } }
  state.root.children = state.root.children.map((node) => {
    const text = paragraphText(node)
    if (text === COOKIE_TABLE_MARKER) return lexicalBlockNode('cookieTable', { groupBy: 'category', showDurations: true })
    if (text === POLICY_VERSION_MARKER) return lexicalBlockNode('policyVersion', { prefix: 'Version' })
    return node
  })
  return state
}

function paragraphText(node: Record<string, unknown>): string | null {
  if (node.type !== 'paragraph' || !Array.isArray(node.children)) return null
  return (node.children as Array<{ type?: string; text?: string }>)
    .map((c) => (c.type === 'text' ? (c.text ?? '') : ''))
    .join('')
    .trim()
}

export async function seedLegalPages(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  seed: SeedOptions & { company: CompanyInfo },
) {
  const effectiveDate = new Date().toISOString().slice(0, 10)
  const docs = buildLegalDocuments(seed.company, effectiveDate, seed.documents ?? ['privacy', 'terms', 'cookies'])
  const created: Array<{ kind: string; id: string | number }> = []
  for (const doc of docs) {
    const content = await markdownToLegalContent(payload, doc.markdown)
    const page = await payload.create({
      collection: options.slugs.legalPages,
      data: {
        title: doc.title,
        slug: doc.slug,
        kind: doc.kind,
        effectiveDate: `${effectiveDate}T00:00:00.000Z`,
        showInFooter: true,
        content,
        _status: 'published',
      } as never,
      overrideAccess: true,
      ...(seed.locale ? { locale: seed.locale as unknown as TypedLocale } : {}),
    })
    created.push({ kind: doc.kind, id: page.id })
  }

  // Point the banner at the seeded pages.
  const privacy = created.find((c) => c.kind === 'privacy')
  const cookies = created.find((c) => c.kind === 'cookies')
  if (privacy || cookies) {
    await payload.updateGlobal({
      slug: options.slugs.settings,
      data: { banner: { ...(privacy ? { privacyPage: privacy.id } : {}), ...(cookies ? { cookiePage: cookies.id } : {}) } } as never,
      overrideAccess: true,
    })
  }
  return created
}
