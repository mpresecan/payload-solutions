import { describe, expect, test } from 'vitest'

import { extractTokens, findTokenProblems, flattenVariables, interpolate } from './interpolate.js'

const manifest = {
  amount: { type: 'number' as const },
  cta: { type: 'html' as const },
  'user.name': {},
  url: { type: 'url' as const },
  when: { type: 'date' as const },
}

describe('interpolate', () => {
  test('replaces tokens and escapes HTML in html mode', () => {
    const out = interpolate('<p>Hi {{user.name}}</p>', { 'user.name': '<b>Ada</b>' }, { manifest, mode: 'html' })
    expect(out).toBe('<p>Hi &lt;b&gt;Ada&lt;/b&gt;</p>')
  })

  test('does not escape in text mode', () => {
    expect(interpolate('Hi {{user.name}}', { 'user.name': 'A & B' }, { manifest, mode: 'text' })).toBe('Hi A & B')
  })

  test('inserts html-typed variables raw in html mode and as text in text mode', () => {
    const vars = { cta: '<a href="https://x.y">Go</a>' }
    expect(interpolate('{{cta}}', vars, { manifest, mode: 'html' })).toBe('<a href="https://x.y">Go</a>')
    expect(interpolate('{{cta}}', vars, { manifest, mode: 'text' })).toBe('Go (https://x.y)')
  })

  test('survives a null or empty locale, which is what req.locale gives without localization', () => {
    const vars = { amount: 1234.5, when: new Date('2026-09-06T10:00:00Z') }
    for (const locale of [null, undefined, ''] as const) {
      expect(() => interpolate('{{amount}} {{when}}', vars, { locale, manifest, mode: 'text' })).not.toThrow()
    }
    expect(interpolate('{{amount}}', vars, { locale: null, manifest, mode: 'text' })).toMatch(/1[,.]?234/)
  })

  test('falls back instead of throwing on a bogus locale', () => {
    const vars = { amount: 5, when: new Date('2026-09-06T10:00:00Z') }
    expect(() => interpolate('{{amount}} {{when}}', vars, { locale: 'not-a-locale!!', manifest, mode: 'text' })).not.toThrow()
  })

  test('formats numbers and dates by locale', () => {
    const vars = { amount: 1234.5, when: new Date('2026-09-06T10:00:00Z') }
    expect(interpolate('{{amount}}', vars, { locale: 'de-DE', manifest, mode: 'text' })).toBe('1.234,5')
    expect(interpolate('{{when}}', vars, { locale: 'en-US', manifest, mode: 'text' })).toContain('2026')
  })

  test('drops unsafe url values', () => {
    expect(interpolate('<a href="{{url}}">x</a>', { url: 'javascript:alert(1)' }, { manifest, mode: 'html' })).toBe('<a href="">x</a>')
    expect(interpolate('{{url}}', { url: 'https://example.com/a?b=1&c=2' }, { manifest, mode: 'html' })).toBe(
      'https://example.com/a?b=1&amp;c=2',
    )
  })

  test('understands percent-encoded tokens left in hrefs by URL encoding', () => {
    expect(interpolate('<a href="%7B%7Burl%7D%7D">x</a>', { url: 'https://e.com' }, { manifest, mode: 'html' })).toBe(
      '<a href="https://e.com">x</a>',
    )
  })

  test('missing variables render empty by default and can be customised', () => {
    expect(interpolate('a{{nope}}b', {}, { mode: 'text' })).toBe('ab')
    expect(interpolate('a{{nope}}b', {}, { mode: 'text', onMissing: (n) => `[${n}]` })).toBe('a[nope]b')
  })

  test('escaped braces render literally', () => {
    expect(interpolate('\\{{not.a.token}}', { 'not.a.token': 'x' }, { mode: 'text' })).toBe('{{not.a.token}}')
  })

  test('tolerates whitespace inside tokens', () => {
    expect(interpolate('{{ user.name }}', { 'user.name': 'Ada' }, { mode: 'text' })).toBe('Ada')
  })
})

describe('tokens', () => {
  test('extractTokens lists unique names', () => {
    expect(extractTokens('{{a}} {{b.c}} {{a}}')).toEqual(['a', 'b.c'])
  })

  test('findTokenProblems reports unknown and unbalanced tokens', () => {
    const allowed = new Set(['a'])
    expect(findTokenProblems('{{a}} {{b}}', allowed)).toEqual([{ name: 'b', type: 'unknown' }])
    expect(findTokenProblems('{{a} oops', allowed)).toEqual([{ type: 'unbalanced' }])
    expect(findTokenProblems('fine {{a}}', allowed)).toEqual([])
  })
})

describe('flattenVariables', () => {
  test('flattens nested objects to dotted paths but keeps dates and arrays', () => {
    const d = new Date()
    expect(flattenVariables({ list: [1, 2], user: { name: 'A', profile: { city: 'B' } }, when: d })).toEqual({
      list: [1, 2],
      'user.name': 'A',
      'user.profile.city': 'B',
      when: d,
    })
  })
})
