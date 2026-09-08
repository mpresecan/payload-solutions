import { describe, expect, test } from 'vitest'

import { definitionHash, sanitizeDefinition, variablesFromInputSchema } from './define.js'
import { validateInput } from './validate-input.js'

const base = {
  slug: 'welcome',
  label: 'Welcome',
  defaults: { body: 'Hi', subject: 'Hello' },
}

describe('sanitizeDefinition', () => {
  test('applies defaults and derives an interface name', () => {
    const def = sanitizeDefinition({ ...base, inputSchema: [{ name: 'url', type: 'text', required: true }] })
    expect(def.audience).toBe('user')
    expect(def.template).toBe('default')
    expect(def.interfaceName).toBe('EmailWelcome')
    expect(def.variables).toEqual({ url: { type: 'string' } })
  })

  test('rejects bad slugs, unsupported fields and secret-looking variables', () => {
    expect(() => sanitizeDefinition({ ...base, slug: 'Bad Slug' })).toThrow(/kebab-case/)
    expect(() => sanitizeDefinition({ ...base, inputSchema: [{ name: 'x', type: 'richText' }] })).toThrow(/not supported/)
    expect(() => sanitizeDefinition({ ...base, variables: { 'reset.token': {} } })).toThrow(/looks like a secret/)
    expect(() => sanitizeDefinition({ ...base, allowSensitiveVariables: true, variables: { 'reset.token': {} } })).not.toThrow()
  })

  test('hash changes only when code-owned metadata changes', () => {
    const a = sanitizeDefinition({ ...base, description: 'one' })
    const b = sanitizeDefinition({ ...base, description: 'one', resolve: () => ({}) })
    const c = sanitizeDefinition({ ...base, description: 'two' })
    expect(definitionHash(a)).toBe(definitionHash(b))
    expect(definitionHash(a)).not.toBe(definitionHash(c))
  })
})

describe('variablesFromInputSchema', () => {
  test('exposes scalar fields only', () => {
    expect(
      variablesFromInputSchema([
        { name: 'name', type: 'text' },
        { name: 'count', type: 'number' },
        { name: 'user', type: 'relationship', relationTo: 'users' },
      ]),
    ).toEqual({ count: { type: 'number' }, name: { type: 'string' } })
  })
})

describe('validateInput', () => {
  const fields = [
    { name: 'email', type: 'email', required: true },
    { name: 'count', type: 'number' },
    { name: 'role', type: 'select', options: ['a', 'b'] },
    { name: 'user', type: 'relationship', relationTo: 'users' },
  ] as const

  test('accepts valid input', () => {
    expect(validateInput([...fields] as never, { count: 1, email: 'a@b.c', role: 'a', user: '1' })).toEqual([])
  })

  test('reports missing, wrong type and bad option', () => {
    expect(validateInput([...fields] as never, { count: 'x', role: 'z' })).toEqual([
      'email is required',
      'count must be a number',
      'role must be one of a, b',
    ])
  })
})
