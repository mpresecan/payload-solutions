import { describe, expect, it } from 'vitest'

import { canonicalJSON, hashArgs, serializeArgs, truncate, uniqueKeyFor } from './hash.js'

describe('canonicalJSON', () => {
  it('sorts keys and drops undefined at every level', () => {
    expect(canonicalJSON({ b: 2, a: { z: undefined, y: 1 } })).toBe('{"a":{"y":1},"b":2}')
  })
  it('serializes dates as ISO strings', () => {
    expect(canonicalJSON({ at: new Date('2026-09-11T09:00:00.000Z') })).toBe('{"at":"2026-09-11T09:00:00.000Z"}')
  })
})

describe('hashArgs', () => {
  it('is order-independent and 32 hex characters', () => {
    expect(hashArgs({ a: 1, b: 2 })).toBe(hashArgs({ b: 2, a: 1 }))
    expect(hashArgs({ a: 1 })).toMatch(/^[0-9a-f]{32}$/)
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }))
  })
  it('treats undefined and {} alike', () => {
    expect(hashArgs(undefined)).toBe(hashArgs({}))
  })
  it('scopes the unique key to hook and group', () => {
    const h = hashArgs({ orderId: '1' })
    expect(uniqueKeyFor('orders.remind', 'orders', h)).not.toBe(uniqueKeyFor('orders.remind', 'default', h))
  })
})

describe('serializeArgs', () => {
  it('measures UTF-8 size', () => {
    const { bytes, json } = serializeArgs('x', { s: 'ż' })
    expect(json).toBe('{"s":"ż"}')
    expect(bytes).toBe(Buffer.byteLength(json))
  })
  it('accepts null and plain data', () => {
    expect(serializeArgs('x', null).value).toEqual({})
    expect(serializeArgs('x', { list: [1, { a: null }] }).value).toEqual({ list: [1, { a: null }] })
  })
  it('rejects non-objects, functions, class instances, circular data and documents', () => {
    expect(() => serializeArgs('x', [1])).toThrow(/plain object/)
    expect(() => serializeArgs('x', { fn: () => 1 })).toThrow(/function/)
    expect(() => serializeArgs('x', { m: new Map() })).toThrow(/Map instance/)
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => serializeArgs('x', circular)).toThrow(/circular/)
    expect(() => serializeArgs('x', { order: { id: 1, createdAt: 'now', title: 'x' } })).toThrow(/looks like a document/)
  })
})

describe('truncate', () => {
  it('keeps short strings and caps long ones with an ellipsis', () => {
    expect(truncate('abc', 5)).toBe('abc')
    expect(truncate('abcdefgh', 5)).toBe('abcd…')
    expect(truncate(null, 5)).toBeNull()
  })
})
