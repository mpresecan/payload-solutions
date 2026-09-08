/**
 * src/emails/definitions: the catalogue of transactional emails, as Payload Emails sees it.
 *
 * No database and no rendering here — these are the checks that catch the mistakes copy and
 * configuration actually produce: a definition that no longer sanitizes, a `{{token}}` typed into
 * the copy that nothing resolves, a message that would go to nobody, and a catalogue that does not
 * follow the features in stack.config.ts.
 */
import { extractTokens, sanitizeDefinition, type EmailDefinition } from '@payload-solutions/plugin-emails'
import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { base, presets } from '../helpers/stack-fixtures'
import { loadWithStack, toStack } from '../helpers/with-stack'

async function load(input = base) {
  const stack = toStack(input)
  const { emailDefinitions } = await loadWithStack(stack, () => import('@/emails/definitions'))
  const { globalVariableManifest } = await loadWithStack(stack, () => import('@/emails/variables'))
  return { definitions: emailDefinitions, globalVariableManifest, stack }
}

const groupsOf = (definitions: EmailDefinition<any>[]) => new Set(definitions.map((d) => d.group))

/** Enough of Payload for the definitions that look a document up while resolving. */
const fakePayload = {
  find: async () => ({ docs: [{ email: 'ada@example.com', id: 1, name: 'Ada Lovelace' }] }),
  findByID: async () => ({ email: 'ada@example.com', id: 1, name: 'Ada Lovelace' }),
} as unknown as Payload

const settings = { siteName: 'Test App', siteUrl: 'https://test.example' }

describe('catalogue', () => {
  it('is unique, sanitizes, and groups every email', async () => {
    const { definitions } = await load(presets['billing-org'])
    const slugs = definitions.map((d) => d.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const definition of definitions) {
      expect(() => sanitizeDefinition(definition)).not.toThrow()
      expect(definition.group).toBeTruthy()
      expect(definition.label).toBeTruthy()
      // Every message says where it comes from, so the admin explains itself.
      expect(definition.trigger).toBeTruthy()
    }
  })

  it.each(Object.entries(presets))('preset %s: follows the features', async (_name, input) => {
    const { definitions, stack } = await load(input)
    const groups = groupsOf(definitions)
    expect(groups.has('Organizations')).toBe(stack.features.organizations)
    expect(groups.has('Billing')).toBe(stack.features.billing)
    // Auth and account emails exist for every product.
    expect(groups.has('Auth')).toBe(true)
    expect(groups.has('Account')).toBe(true)

    const slugs = definitions.map((d) => d.slug)
    expect(slugs.includes('magic-link')).toBe(stack.features.magicLink)
    expect(slugs.includes('password-reset')).toBe(stack.features.emailPassword)
    expect(slugs.includes('two-factor-code')).toBe(stack.features.twoFactor)
  })

  it('marks the emails a product may not switch off', async () => {
    const { definitions } = await load(presets['billing-org'])
    const required = definitions.filter((d) => d.required).map((d) => d.slug)
    expect(required).toContain('password-reset')
    expect(required).toContain('email-verification')
    expect(required).toContain('payment-failed')
  })
})

describe('copy', () => {
  it('uses only variables the email or the globals resolve', async () => {
    const { definitions, globalVariableManifest } = await load(presets['billing-org'])
    for (const definition of definitions) {
      const known = new Set([...Object.keys(globalVariableManifest), ...Object.keys(definition.variables ?? {})])
      const copy = [
        definition.defaults.subject,
        definition.defaults.preheader ?? '',
        definition.defaults.body,
      ].filter((part): part is string => typeof part === 'string')
      for (const token of copy.flatMap(extractTokens)) {
        expect({ slug: definition.slug, token, known: known.has(token) }).toEqual({
          slug: definition.slug,
          token,
          known: true,
        })
      }
    }
  })

  it('gives every email a subject and a body', async () => {
    const { definitions } = await load(presets['billing-org'])
    for (const definition of definitions) {
      expect(definition.defaults.subject, definition.slug).toBeTruthy()
      expect(definition.defaults.body, definition.slug).toBeTruthy()
    }
  })
})

describe('recipients', () => {
  it('resolves the sample input to a real address for every email', async () => {
    const { definitions } = await load(presets['billing-org'])
    for (const definition of definitions) {
      const input =
        typeof definition.sample === 'function'
          ? await definition.sample({ payload: fakePayload })
          : (definition.sample ?? {})
      const variables = definition.resolve
        ? await definition.resolve({ input: input as never, payload: fakePayload, settings })
        : input
      const to = await definition.to?.({
        input: input as never,
        payload: fakePayload,
        settings,
        variables: variables as never,
      })
      expect({ slug: definition.slug, to }).toEqual({ slug: definition.slug, to: expect.stringContaining('@') })
    }
  })
})
