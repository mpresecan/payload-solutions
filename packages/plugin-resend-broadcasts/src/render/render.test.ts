import { describe, expect, test } from 'vitest'

import { sanitizeOptions } from '../options.js'
import { absoluteUrl, findPrivateImages, isPublicImageUrl } from './images.js'
import { toSubscriber } from '../sources/subscriber.js'
import { extractTokens, findTokenProblems, interpolate } from './interpolate.js'
import { allowedTokens, createResolver } from './render.js'

const options = sanitizeOptions({
  sources: [
    {
      collection: 'subscribers' as never,
      properties: {
        company: { type: 'string', fallback: 'your team', value: ({ doc }) => doc.company },
        seats: { type: 'number', value: ({ doc }) => doc.seats },
      },
    },
  ],
})
const source = options.sources[0]!
const ada = toSubscriber(source, {
  id: 1,
  company: 'AE',
  email: ' Ada@Example.COM ',
  name: 'Ada King Lovelace',
  seats: '3',
  subscribed: true,
})
const globals = { 'site.name': 'Acme', year: 2026 }

describe('tokens', () => {
  test('should read names and fallbacks, including percent-encoded ones from link URLs', () => {
    expect([...extractTokens('Hi {{ firstName | there }} %7B%7Bemail%7D%7D').entries()]).toEqual([
      ['firstName', 'there'],
      ['email', undefined],
    ])
  })

  test('should keep an escaped token literal', () => {
    expect(interpolate('\\{{name}} and {{name}}', () => 'Ada')).toBe('{{name}} and Ada')
  })

  test('should flag unknown and unbalanced tokens', () => {
    expect(findTokenProblems('{{nope}} {{ broken', new Set(['name']))).toEqual([
      { name: 'nope', type: 'unknown' },
      { type: 'unbalanced' },
    ])
  })

  test('should allow only values that are the same for everyone in the subject', () => {
    const allowed = allowedTokens(options, globals)
    expect(allowed.everyone.has('site.name')).toBe(true)
    expect(allowed.everyone.has('firstName')).toBe(false)
    expect(allowed.body.has('company')).toBe(true)
  })
})

describe('subscribers', () => {
  test('should normalise the email, split the name and coerce properties', () => {
    expect(ada).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'King Lovelace',
      name: 'Ada King Lovelace',
      properties: { company: 'AE', seats: 3 },
      subscribed: true,
    })
  })
})

describe('resolver', () => {
  test('should fill tokens from the subscriber in preview mode, with fallbacks for empty values', () => {
    const { resolve } = createResolver({
      globals,
      mode: 'preview',
      options,
      subscriber: ada,
      unsubscribeUrl: '#u',
    })
    expect(
      interpolate(
        '{{firstName}} at {{company}}, {{site.name}} {{year}} {{unsubscribeUrl}}',
        resolve,
      ),
    ).toBe('Ada at AE, Acme 2026 #u')

    const nobody = toSubscriber(source, { id: 2, email: 'x@example.com', subscribed: true })
    const empty = createResolver({
      globals,
      mode: 'preview',
      options,
      subscriber: nobody,
      unsubscribeUrl: '#u',
    }).resolve
    expect(interpolate('{{firstName|there}} {{company}} {{company|pal}}', empty)).toBe(
      'there your team pal',
    )
  })

  test('should emit Resend placeholders in broadcast mode and inline shared values', () => {
    const { resolve, used } = createResolver({
      globals,
      mode: 'broadcast',
      options,
      unsubscribeUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}',
    })
    expect(
      interpolate(
        '{{firstName|there}} {{name}} {{company}} {{seats}} {{site.name}} {{unsubscribeUrl}}',
        resolve,
      ),
    ).toBe(
      '{{{contact.first_name|there}}} {{{contact.full_name}}} {{{contact.company|your team}}} {{{contact.seats}}} Acme {{{RESEND_UNSUBSCRIBE_URL}}}',
    )
    expect(Object.keys(used)).toEqual([
      'firstName',
      'name',
      'company',
      'seats',
      'site.name',
      'unsubscribeUrl',
    ])
  })

  test('should strip characters that would break a placeholder from a fallback', () => {
    const { resolve } = createResolver({ globals, mode: 'broadcast', options, unsubscribeUrl: '' })
    expect(resolve('firstName', 'fr{ie}nd')).toBe('{{{contact.first_name|friend}}}')
  })
})

describe('options', () => {
  test('should reject property keys Resend cannot store and ones that shadow built-ins', () => {
    const build = (key: string) => () =>
      sanitizeOptions({
        sources: [
          { collection: 'x' as never, properties: { [key]: { type: 'string', value: () => '' } } },
        ],
      })
    expect(build('has-dash')).toThrow(/letters, digits/)
    expect(build('firstName')).toThrow(/built-in/)
    expect(build('full_name')).toThrow(/built-in/)
  })

  test('should reject one key typed differently in two sources', () => {
    expect(() =>
      sanitizeOptions({
        sources: [
          { collection: 'a' as never, properties: { plan: { type: 'string', value: () => '' } } },
          { collection: 'b' as never, properties: { plan: { type: 'number', value: () => 0 } } },
        ],
      }),
    ).toThrow(/one type per key/)
  })
})

describe('images', () => {
  test('should tell public image URLs from ones an inbox cannot load', () => {
    expect(isPublicImageUrl('https://cdn.example.com/a.png')).toBe(true)
    expect(isPublicImageUrl('http://example.com/a.png')).toBe(true)
    for (const src of [
      '/api/media/file/a.png',
      'http://localhost:3000/a.png',
      'http://127.0.0.1/a.png',
      'http://192.168.1.4/a.png',
      'http://172.20.0.1/a.png',
      'https://site.local/a.png',
      'data:image/png;base64,AAAA',
    ]) {
      expect(isPublicImageUrl(src)).toBe(false)
    }
  })

  test('should find every private <img src> once, decoding entities', () => {
    const out = findPrivateImages(
      '<img src="https://ok.com/a.png"><img alt="" src="http://localhost/b.png?x=1&amp;y=2"><img src="http://localhost/b.png?x=1&amp;y=2">',
    )
    expect(out).toEqual(['http://localhost/b.png?x=1&y=2'])
  })

  test('should prefix relative upload URLs and keep absolute ones', () => {
    expect(absoluteUrl('/api/media/file/a.png', 'https://site.com/')).toBe(
      'https://site.com/api/media/file/a.png',
    )
    expect(absoluteUrl('https://s3.example.com/a.png', 'https://site.com')).toBe(
      'https://s3.example.com/a.png',
    )
    // Payload makes upload URLs absolute on serverURL; a public base moves them over.
    expect(
      absoluteUrl(
        'http://admin.internal:3000/api/media/file/a.png',
        'https://site.com',
        'http://admin.internal:3000',
      ),
    ).toBe('https://site.com/api/media/file/a.png')
  })
})
