import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consentModeStateFrom,
  createConsentStore,
  createTestConfig,
  decodeConsentCookie,
  encodeConsentCookie,
  memoryStorage,
  resolveConsent,
  type ConsentConfig,
  type ConsentRecordInput,
} from '../src/index.js'

const NOW = 1_757_000_000
let counter = 0
const uuid = () => `11111111-1111-4111-8111-${String(counter++).padStart(12, '0')}`

function make(config: ConsentConfig, cookie: string | null = null, extra: Partial<Parameters<typeof createConsentStore>[0]> = {}) {
  const storage = memoryStorage(cookie)
  const records: ConsentRecordInput[] = []
  const store = createConsentStore({
    config,
    storage,
    gpc: false,
    now: () => NOW,
    uuid,
    record: (r) => {
      records.push(r)
    },
    ...extra,
  })
  return { store, storage, records }
}

describe('initial state', () => {
  it('opt-in without a cookie: everything non-required denied, banner open', () => {
    const { store } = make(createTestConfig())
    const s = store.getState()
    expect(s.status).toBe('undecided')
    expect(s.ui).toBe('banner')
    expect(s.decisions).toEqual({ functional: false, analytics: false, marketing: false })
    expect(store.has('necessary')).toBe(true)
    expect(store.has('analytics')).toBe(false)
  })

  it('opt-out without a cookie: granted by default, notice shown, GPC denies respectGPC categories', () => {
    const config = createTestConfig({ jurisdiction: { country: 'US', model: 'opt-out' } })
    expect(make(config).store.getState().decisions).toEqual({ functional: true, analytics: true, marketing: true })
    const withGpc = make(config, null, { gpc: true }).store.getState()
    expect(withGpc.decisions).toEqual({ functional: true, analytics: false, marketing: false })
    expect(withGpc.gpc).toBe(true)
  })

  it('none model: granted, no UI', () => {
    const { store } = make(createTestConfig({ jurisdiction: { country: 'JP', model: 'none' } }))
    expect(store.getState().ui).toBe('closed')
    expect(store.has('marketing')).toBe(true)
  })

  it('restores decisions from a current cookie and stays closed', () => {
    const config = createTestConfig()
    const id = uuid()
    const cookie = encodeConsentCookie({ v: 1, id, d: { functional: 1, analytics: 1, marketing: 0 }, t: NOW - 100, pv: 'p1', cv: 'c1', tv: 't1', dv: 'd1', j: 'in', s: 'b' })
    const s = make(config, cookie).store.getState()
    expect(s.status).toBe('decided')
    expect(s.ui).toBe('closed')
    expect(s.decisions).toEqual({ functional: true, analytics: true, marketing: false })
    expect(s.consentId).toBe(id)
  })

  it('re-prompts when a watched version changed or the cookie expired, keeping previous decisions as draft', () => {
    const config = createTestConfig()
    const base = { v: 1 as const, id: uuid(), d: { functional: 1 as const, analytics: 1 as const, marketing: 0 as const }, t: NOW - 100, pv: 'p1', cv: 'c1', tv: 't1', dv: 'd1', j: 'in' as const, s: 'b' as const }
    const docs = make(config, encodeConsentCookie({ ...base, dv: 'd0' })).store.getState()
    expect(docs.status).toBe('stale')
    expect(docs.repromptReason).toBe('documents')
    expect(docs.ui).toBe('banner')
    expect(docs.draft).toEqual({ functional: true, analytics: true, marketing: false })

    // trackers are not in reconsent.on by default → no reprompt
    expect(make(config, encodeConsentCookie({ ...base, tv: 't0' })).store.getState().status).toBe('decided')

    const expired = make(config, encodeConsentCookie({ ...base, t: NOW - 200 * 86400 })).store.getState()
    expect(expired.repromptReason).toBe('expired')
  })

  it('applies model defaults to categories added since the cookie was written', () => {
    const config = createTestConfig({ jurisdiction: { country: 'US', model: 'opt-out' } })
    const cookie = encodeConsentCookie({ v: 1, id: uuid(), d: { analytics: 0 }, t: NOW - 100, pv: 'p1', cv: 'c1', tv: 't1', dv: 'd1', j: 'out', s: 'p' })
    expect(resolveConsent(cookie, config, { now: NOW }).decisions).toEqual({ functional: true, analytics: false, marketing: true })
  })
})

describe('decisions', () => {
  let ctx: ReturnType<typeof make>
  beforeEach(() => {
    ctx = make(createTestConfig({ recording: { enabled: true, endpoint: '/api/consent/records' } }))
  })

  it('acceptAll grants everything, persists the cookie and records the decision', () => {
    ctx.store.acceptAll()
    const s = ctx.store.getState()
    expect(s.status).toBe('decided')
    expect(s.ui).toBe('closed')
    expect(s.decisions).toEqual({ functional: true, analytics: true, marketing: true })
    const cookie = decodeConsentCookie(ctx.storage.value)
    expect(cookie?.d).toEqual({ functional: 1, analytics: 1, marketing: 1 })
    expect(cookie?.s).toBe('b')
    expect(cookie?.pv).toBe('p1')
    expect(ctx.records).toHaveLength(1)
    expect(ctx.records[0]?.source).toBe('banner')
  })

  it('toggle edits the draft only until save', () => {
    ctx.store.open('preferences')
    ctx.store.toggle('analytics')
    expect(ctx.store.getState().draft.analytics).toBe(true)
    expect(ctx.store.getState().decisions.analytics).toBe(false)
    ctx.store.toggle('necessary') // required: ignored
    ctx.store.save()
    expect(ctx.store.getState().decisions).toEqual({ functional: false, analytics: true, marketing: false })
    expect(ctx.records[0]?.source).toBe('preferences')
  })

  it('close discards the draft', () => {
    ctx.store.open('preferences')
    ctx.store.toggle('marketing', true)
    ctx.store.close()
    expect(ctx.store.getState().draft.marketing).toBe(false)
    expect(ctx.store.getState().ui).toBe('closed')
  })

  it('revoking a granted category flags needsReload; withdraw rotates the consent id', () => {
    ctx.store.acceptAll()
    ctx.store.open('preferences')
    ctx.store.toggle('analytics', false)
    ctx.store.save()
    expect(ctx.store.getState().needsReload).toBe(true)
    const before = ctx.store.getState().consentId
    ctx.store.withdraw()
    const s = ctx.store.getState()
    expect(s.decisions).toEqual({ functional: false, analytics: false, marketing: false })
    expect(s.consentId).not.toBe(before)
    expect(ctx.records.at(-1)?.source).toBe('withdraw')
  })

  it('notifies onChange listeners and dispatches consentchange', () => {
    const listener = vi.fn()
    const event = vi.fn()
    window.addEventListener('consentchange', event)
    ctx.store.onChange(listener)
    ctx.store.acceptAll()
    expect(listener).toHaveBeenCalledWith({ functional: true, analytics: true, marketing: true }, { functional: false, analytics: false, marketing: false })
    expect(event).toHaveBeenCalledTimes(1)
    window.removeEventListener('consentchange', event)
  })

  it('dismiss under opt-in hides the banner without storing anything; under notice it stores an implicit decision', () => {
    ctx.store.dismiss()
    expect(ctx.store.getState().ui).toBe('closed')
    expect(ctx.storage.value).toBeNull()
    const notice = make(createTestConfig({ jurisdiction: { country: 'JP', model: 'notice' } }))
    notice.store.dismiss()
    expect(decodeConsentCookie(notice.storage.value)?.s).toBe('i')
  })

  it('evaluates expressions', () => {
    ctx.store.open('preferences')
    ctx.store.toggle('analytics', true)
    ctx.store.save()
    expect(ctx.store.has({ and: ['analytics', 'necessary'] })).toBe(true)
    expect(ctx.store.has({ or: ['marketing', 'analytics'] })).toBe(true)
    expect(ctx.store.has({ not: 'marketing' })).toBe(true)
    expect(ctx.store.has('unknown')).toBe(false)
  })
})

describe('consent mode mapping', () => {
  it('grants signals declared by granted or required categories, security_storage always', () => {
    const config = createTestConfig()
    const state = consentModeStateFrom(config.categories, (k) => k === 'analytics')
    expect(state).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
    })
  })
})
