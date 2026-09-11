import { describe, expect, test } from 'vitest'

import type { VercelDeployment } from '../vercel/types.js'

import { classifyChange, resolveTitle, summarize } from '../changes/summary.js'
import { formatDuration, parseDuration } from '../utils/duration.js'
import { signVercelPayload, verifyVercelSignature } from '../utils/hmac.js'
import { matchDeployment, unclaimedDeployments } from './match.js'
import { isDue, nextWindow, rollingHour, windowDedupeKey } from './schedule.js'
import { canTransition, patchFromVercel, stateFromVercel } from './state.js'

const T0 = new Date('2026-09-11T10:00:00.000Z')
const at = (ms: number) => new Date(T0.getTime() + ms)

describe('debounce window', () => {
  test('the first change opens a window one quiet period out', () => {
    const w = nextWindow({ dueAt: null, pendingSince: null }, T0, 60_000, 600_000)
    expect(w.pendingSince).toEqual(T0)
    expect(w.dueAt).toEqual(at(60_000))
  })

  test('later changes push the window out but never past pendingSince + maxWait', () => {
    let w = nextWindow({ dueAt: null, pendingSince: null }, T0, 60_000, 180_000)
    w = nextWindow(w, at(50_000), 60_000, 180_000)
    expect(w.dueAt).toEqual(at(110_000))
    w = nextWindow(w, at(150_000), 60_000, 180_000)
    expect(w.dueAt).toEqual(at(180_000))
    expect(w.pendingSince).toEqual(T0)
  })

  test('isDue compares against now; the window key is stable for a window', () => {
    expect(isDue({ dueAt: at(1000).toISOString() }, T0)).toBe(false)
    expect(isDue({ dueAt: at(1000) }, at(1000))).toBe(true)
    expect(isDue({ dueAt: null }, T0)).toBe(false)
    expect(windowDedupeKey('production', at(1000))).toBe(`production:auto:${at(1000).getTime()}`)
    expect(windowDedupeKey('production', at(1000).toISOString())).toBe(windowDedupeKey('production', at(1000)))
  })

  test('rollingHour keeps the last hour and appends', () => {
    const times = [at(-3_700_000), at(-1_000_000), at(-10)]
    expect(rollingHour(times, T0)).toHaveLength(2)
    expect(rollingHour(times, T0, true)).toHaveLength(3)
    expect(rollingHour(null, T0)).toEqual([])
  })
})

describe('matching a hook call to a deployment', () => {
  const dep = (uid: string, created: number, source: VercelDeployment['source'] = 'git-deploy-hook'): VercelDeployment => ({
    created,
    name: 'site',
    readyState: 'BUILDING',
    source,
    uid,
    url: `${uid}.vercel.app`,
  })

  test('picks the earliest unclaimed hook deployment created after the call (minus skew)', () => {
    const hookCalledAt = at(0)
    const deployments = [dep('late', at(5000).getTime()), dep('git', at(1000).getTime(), 'git'), dep('early', at(1000).getTime()), dep('old', at(-60_000).getTime())]
    expect(matchDeployment({ claimed: new Set(), deployments, hookCalledAt })?.uid).toBe('early')
    expect(matchDeployment({ claimed: new Set(['early']), deployments, hookCalledAt })?.uid).toBe('late')
    expect(matchDeployment({ claimed: new Set(['early', 'late']), deployments, hookCalledAt })).toBeNull()
  })

  test('tolerates 30 s of clock skew', () => {
    const hookCalledAt = at(0)
    expect(matchDeployment({ claimed: new Set(), deployments: [dep('skew', at(-20_000).getTime())], hookCalledAt })?.uid).toBe('skew')
    expect(matchDeployment({ claimed: new Set(), deployments: [dep('too-old', at(-40_000).getTime())], hookCalledAt })).toBeNull()
  })

  test('unclaimedDeployments filters by id', () => {
    const list = [dep('a', 1), dep('b', 2)]
    expect(unclaimedDeployments(list, new Set(['a'])).map((d) => d.uid)).toEqual(['b'])
  })
})

describe('state machine', () => {
  test('maps Vercel ready states', () => {
    expect(stateFromVercel('QUEUED')).toBe('queued')
    expect(stateFromVercel('INITIALIZING')).toBe('queued')
    expect(stateFromVercel('BUILDING')).toBe('building')
    expect(stateFromVercel('READY')).toBe('ready')
    expect(stateFromVercel('ERROR')).toBe('error')
    expect(stateFromVercel('CANCELED')).toBe('canceled')
    expect(stateFromVercel('DELETED')).toBe('unknown')
    expect(stateFromVercel(undefined)).toBe('unknown')
  })

  test('terminal states never regress, building never goes back to queued', () => {
    expect(canTransition('triggered', 'queued')).toBe(true)
    expect(canTransition('queued', 'building')).toBe(true)
    expect(canTransition('building', 'ready')).toBe(true)
    expect(canTransition('building', 'queued')).toBe(false)
    expect(canTransition('ready', 'building')).toBe(false)
    expect(canTransition('error', 'ready')).toBe(false)
    expect(canTransition('ready', 'ready')).toBe(false)
  })

  test('patchFromVercel derives urls, environment, timestamps and duration', () => {
    const patch = patchFromVercel({
      buildingAt: 1000,
      created: 500,
      errorMessage: null,
      inspectorUrl: 'https://vercel.com/x/y',
      name: 'site',
      ready: 9500,
      readyState: 'READY',
      readySubstate: 'PROMOTED',
      target: 'production',
      uid: 'dpl_1',
      url: 'site-abc.vercel.app',
    })
    expect(patch).toMatchObject({
      deploymentId: 'dpl_1',
      deploymentUrl: 'https://site-abc.vercel.app',
      durationMs: 9000,
      environment: 'production',
      inspectorUrl: 'https://vercel.com/x/y',
      readySubstate: 'PROMOTED',
      state: 'ready',
    })
    expect(patch.vercelCreatedAt).toBe(new Date(500).toISOString())
    expect(patchFromVercel({ name: 's', readyState: 'BUILDING', target: null, uid: 'd', url: null }).environment).toBe('preview')
  })
})

describe('change classification and summaries', () => {
  test('publish semantics on drafts collections', () => {
    const base = { hasDrafts: true, on: 'publish' as const }
    expect(classifyChange({ ...base, doc: { _status: 'draft' }, operation: 'create' })).toBeNull()
    expect(classifyChange({ ...base, doc: { _status: 'published' }, operation: 'update' })).toBe('publish')
    expect(classifyChange({ ...base, doc: { _status: 'draft' }, operation: 'update', previousDoc: { _status: 'published' } })).toBe('unpublish')
    expect(classifyChange({ ...base, doc: { _status: 'draft' }, operation: 'update', previousDoc: { _status: 'draft' } })).toBeNull()
  })

  test('every save counts without drafts or with on: change', () => {
    expect(classifyChange({ doc: {}, hasDrafts: false, on: 'change', operation: 'create' })).toBe('create')
    expect(classifyChange({ doc: {}, hasDrafts: false, on: 'change', operation: 'update' })).toBe('update')
    expect(classifyChange({ doc: { _status: 'draft' }, hasDrafts: true, on: 'change', operation: 'update' })).toBe('update')
  })

  test('titles come from useAsTitle, localized values and ids, and are capped', () => {
    expect(resolveTitle({ title: ' Home ' }, 'title', 1)).toBe('Home')
    expect(resolveTitle({ title: { en: 'Hello', de: 'Hallo' } }, 'title', 1)).toBe('Hello')
    expect(resolveTitle({ title: '' }, 'title', 42)).toBe('#42')
    expect(resolveTitle({}, undefined, 'abc')).toBe('#abc')
    expect(resolveTitle({ title: 'x'.repeat(200) }, 'title', 1)).toHaveLength(120)
  })

  test('summarize counts per collection and caps items at 100', () => {
    const rows = Array.from({ length: 130 }, (_, i) => ({
      changedAt: '',
      collection: i % 2 ? 'pages' : 'posts',
      docId: String(i),
      id: i,
      operation: 'update' as const,
      saves: 1,
      target: 'production',
      title: `Doc ${i}`,
    }))
    rows.push({ changedAt: '', collection: null as never, docId: null as never, global: 'header', id: 999, operation: 'update', saves: 1, target: 'production', title: 'Header' } as never)
    const summary = summarize(rows as never)
    expect(summary.counts).toEqual({ 'global:header': 1, pages: 65, posts: 65 })
    expect(summary.items).toHaveLength(100)
    expect(summary.items[0]).toEqual({ c: 'posts', id: '0', op: 'update', t: 'Doc 0' })
  })
})

describe('utilities', () => {
  test('durations parse and format', () => {
    expect(parseDuration('60s', 0)).toBe(60_000)
    expect(parseDuration('2m', 0)).toBe(120_000)
    expect(parseDuration('1.5h', 0)).toBe(5_400_000)
    expect(parseDuration('250ms', 0)).toBe(250)
    expect(parseDuration('45', 0)).toBe(45_000)
    expect(parseDuration(500, 0)).toBe(500)
    expect(parseDuration(undefined, 7)).toBe(7)
    expect(() => parseDuration('soon', 0)).toThrow(/Invalid duration/)
    expect(formatDuration(4000)).toBe('0:04')
    expect(formatDuration(90_000)).toBe('1:30')
    expect(formatDuration(3_720_000)).toBe('1:02:00')
  })

  test('webhook signatures use HMAC-SHA1 over the raw body', () => {
    const body = '{"id":"evt_1","type":"deployment.ready"}'
    const sig = signVercelPayload(body, 'secret')
    expect(sig).toMatch(/^[0-9a-f]{40}$/)
    expect(verifyVercelSignature(body, sig, 'secret')).toBe(true)
    expect(verifyVercelSignature(body, sig.toUpperCase(), 'secret')).toBe(true)
    expect(verifyVercelSignature(`${body} `, sig, 'secret')).toBe(false)
    expect(verifyVercelSignature(body, sig, 'other')).toBe(false)
    expect(verifyVercelSignature(body, null, 'secret')).toBe(false)
    expect(verifyVercelSignature(body, 'abc', 'secret')).toBe(false)
  })
})
