/**
 * src/seed/legal.ts: the legal pages seeded on first boot. Runs against a fake Payload so the
 * idempotency check, the page set and the text (company, jurisdiction, support address, product
 * name from stack.config.ts) can be asserted without a database.
 */
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { base } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

type Created = { collection: string; data: Record<string, unknown>; overrideAccess?: boolean }

function fakePayload(existingCount: number) {
  const created: Created[] = []
  const payload = {
    count: vi.fn(async () => ({ totalDocs: existingCount })),
    create: vi.fn(async (args: Created) => {
      created.push(args)
      return { id: created.length, ...args.data }
    }),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as unknown as Payload
  return { payload, created }
}

/** Flattens a Lexical richText tree into its text content. */
function textOf(content: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: string; children?: unknown[]; root?: unknown }
    if (typeof n.text === 'string') out.push(n.text)
    if (n.root) walk(n.root)
    for (const child of n.children ?? []) walk(child)
  }
  walk(content)
  return out.join('\n')
}

const product = {
  ...base,
  name: 'Ridgeline',
  support: { email: 'help@ridgeline.test' },
  legal: { company: 'Ridgeline Software Ltd', jurisdiction: 'Poland' },
}

const load = () => loadWithStack(product, () => import('@/seed/legal'))

describe('seedLegalPages', () => {
  it('does nothing when legal pages already exist', async () => {
    const { seedLegalPages } = await load()
    const { payload, created } = fakePayload(3)
    await seedLegalPages(payload)
    expect(payload.count).toHaveBeenCalledWith({ collection: 'legal-pages', overrideAccess: true })
    expect(created).toHaveLength(0)
  })

  it('creates privacy, terms and cookies as published footer pages effective today', async () => {
    const { seedLegalPages } = await load()
    const { payload, created } = fakePayload(0)
    const before = Date.now()
    await seedLegalPages(payload)

    expect(created.map((c) => c.collection)).toEqual(['legal-pages', 'legal-pages', 'legal-pages'])
    expect(created.map((c) => c.data.slug)).toEqual(['privacy', 'terms', 'cookies'])
    expect(created.map((c) => c.data.title)).toEqual(['Privacy Policy', 'Terms of Service', 'Cookie Policy'])
    for (const page of created) {
      expect(page.overrideAccess).toBe(true)
      expect(page.data._status).toBe('published')
      expect(page.data.showInFooter).toBe(true)
      const effective = Date.parse(page.data.effectiveDate as string)
      expect(effective).toBeGreaterThanOrEqual(before - 1000)
      expect(effective).toBeLessThanOrEqual(Date.now() + 1000)
    }
    expect(payload.logger.info).toHaveBeenCalledWith('Seeded 3 legal pages for Ridgeline Software Ltd')
  })

  it('writes the company, jurisdiction, product name and support address into the text', async () => {
    const { seedLegalPages } = await load()
    const { payload, created } = fakePayload(0)
    await seedLegalPages(payload)
    const byslug = Object.fromEntries(created.map((c) => [c.data.slug as string, textOf(c.data.content)]))

    expect(byslug.privacy).toContain('Ridgeline Software Ltd')
    expect(byslug.privacy).toContain('Ridgeline')
    expect(byslug.privacy).toContain('help@ridgeline.test')
    expect(byslug.privacy).toContain('laws of Poland')

    expect(byslug.terms).toContain('provided by Ridgeline Software Ltd')
    expect(byslug.terms).toContain('laws of Poland')
    expect(byslug.terms).toContain('help@ridgeline.test')

    expect(byslug.cookies).toContain('Ridgeline uses a small number of cookies')

    for (const text of Object.values(byslug)) {
      expect(text).not.toContain('Example Software')
      expect(text).not.toContain('Payload Stack')
      expect(text).not.toContain('undefined')
    }
  })

  it('produces valid Lexical documents: a root with headings (h2) and paragraphs of text nodes', async () => {
    const { seedLegalPages } = await load()
    const { payload, created } = fakePayload(0)
    await seedLegalPages(payload)
    for (const page of created) {
      const content = page.data.content as { root: { type: string; children: Array<{ type: string; tag?: string; children: Array<{ type: string; text: string }> }> } }
      expect(content.root.type).toBe('root')
      expect(content.root.children.length).toBeGreaterThan(2)
      const types = new Set(content.root.children.map((n) => n.type))
      expect(types).toEqual(new Set(['heading', 'paragraph']))
      for (const node of content.root.children) {
        if (node.type === 'heading') expect(node.tag).toBe('h2')
        expect(node.children).toHaveLength(1)
        expect(node.children[0]).toMatchObject({ type: 'text', version: 1 })
        expect(node.children[0]!.text.length).toBeGreaterThan(0)
      }
      // Every heading is followed by its paragraph.
      content.root.children.forEach((node, i, all) => {
        if (node.type === 'heading') expect(all[i + 1]?.type).toBe('paragraph')
      })
    }
  })
})
