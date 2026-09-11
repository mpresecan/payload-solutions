import type { Payload, SanitizedConfig } from 'payload'

import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import type { DeploymentRecord, PendingChange, TargetStateRecord } from '../src/types.js'

import { signVercelPayload } from '../src/utils/hmac.js'
import { createMockVercel } from './vercel-mock/mock.mjs'

/* ------------------------------------------------------------------ */
/* Environment: the mock Vercel must be up before the config loads     */
/* ------------------------------------------------------------------ */

const MOCK_PORT = Number(process.env.VERCEL_MOCK_TEST_PORT ?? 3499)
const PROJECT = 'prj_test00000000000000000'
const WEBHOOK_SECRET = 'test-webhook-secret'
const TICK_SECRET = 'test-tick-secret'

Object.assign(process.env, { NODE_ENV: 'test' })
process.env.VERCEL_API_BASE = `http://127.0.0.1:${MOCK_PORT}`
process.env.VERCEL_DEPLOY_HOOK_PRODUCTION = `http://127.0.0.1:${MOCK_PORT}/v1/integrations/deploy/${PROJECT}/hook_production`
process.env.VERCEL_DEPLOY_HOOK_STAGING = `http://127.0.0.1:${MOCK_PORT}/v1/integrations/deploy/${PROJECT}/hook_staging`
process.env.VERCEL_TOKEN = 'test-token'
process.env.VERCEL_WEBHOOK_SECRET = WEBHOOK_SECRET
process.env.VERCEL_TICK_SECRET = TICK_SECRET
process.env.VERCEL_QUIET_PERIOD = '1500ms'
process.env.VERCEL_MAX_WAIT = '4s'
process.env.VERCEL_RETENTION_DAYS = '30'
process.env.VERCEL_RETENTION_KEEP = '5'

const mock = createMockVercel({ buildDelayMs: 150, buildTimeMs: 300 })

let payload: Payload
let config: SanitizedConfig
let token = ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const api = () => payload.vercel

async function pending(target: string): Promise<PendingChange[]> {
  return api().pending(target)
}
async function state(target: string): Promise<TargetStateRecord> {
  const { docs } = await payload.find({ collection: 'vercel-targets', limit: 1, overrideAccess: true, where: { slug: { equals: target } } })
  return docs[0] as unknown as TargetStateRecord
}
async function deployments(target?: string): Promise<DeploymentRecord[]> {
  const { docs } = await payload.find({
    collection: 'vercel-deployments',
    limit: 100,
    overrideAccess: true,
    sort: '-createdAt',
    where: target ? { target: { equals: target } } : {},
  })
  return docs as unknown as DeploymentRecord[]
}
async function refreshUntil(target: string, predicate: (rows: DeploymentRecord[]) => boolean, timeoutMs = 8000): Promise<DeploymentRecord[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await api().refresh(target)
    const rows = await deployments(target)
    if (predicate(rows)) {
      return rows
    }
    await sleep(120)
  }
  return deployments(target)
}
async function resetAll() {
  await fetch(`${process.env.VERCEL_API_BASE}/__mock/reset`, { body: JSON.stringify({ buildDelayMs: 150, buildTimeMs: 300 }), method: 'POST' })
  // Content first, with the skip flag so the delete hooks record nothing; the plugin tables last.
  for (const collection of ['pages', 'posts', 'notes']) {
    await payload.delete({ collection: collection as never, context: { vercelSkip: true }, overrideAccess: true, where: {} })
  }
  for (const collection of ['vercel-changes', 'vercel-deployments']) {
    await payload.delete({ collection: collection as never, overrideAccess: true, where: {} })
  }
  for (const target of ['production', 'staging']) {
    const s = await state(target)
    await payload.update({
      id: s.id,
      collection: 'vercel-targets',
      data: { currentDeploymentId: null, currentState: null, dueAt: null, lastError: null, lastExternalScanAt: null, lastTriggerAt: null, paused: false, pendingSince: null, triggerTimes: [] } as never,
      overrideAccess: true,
    })
  }
}
function endpoint(method: string, path: string) {
  const found = config.endpoints.find((e) => e.path === path && e.method === method)
  if (!found) {
    throw new Error(`No endpoint ${method} ${path}`)
  }
  return found
}
async function call(method: 'GET' | 'PATCH' | 'POST', path: string, opts: { auth?: boolean; body?: unknown; headers?: Record<string, string>; query?: Record<string, string> } = {}) {
  const url = new URL(`http://localhost:3400/api${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    url.searchParams.set(k, v)
  }
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.auth !== false) {
    headers.authorization = `JWT ${token}`
  }
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  const request = new Request(url, { body: opts.body === undefined ? undefined : JSON.stringify(opts.body), headers, method })
  const req = await createPayloadRequest({ config, request })
  const res = await endpoint(method.toLowerCase(), path).handler(req)
  return { json: (await res.json()) as any, status: res.status }
}

beforeAll(async () => {
  await mock.listen(MOCK_PORT)
  const mod = await import('@payload-config')
  config = await mod.default
  payload = await getPayload({ config })
  const login = await payload.login({ collection: 'users', data: { email: 'dev@payloadcms.com', password: 'test' } })
  token = login.token ?? ''
  await resetAll()
})

afterAll(async () => {
  await payload.destroy()
  await mock.close()
})

beforeEach(async () => {
  await resetAll()
})

/* ------------------------------------------------------------------ */

describe('setup', () => {
  test('registers the plugin collections and payload.vercel', async () => {
    expect(payload.collections['vercel-deployments' as never]).toBeDefined()
    expect(payload.collections['vercel-changes' as never]).toBeDefined()
    expect(payload.collections['vercel-targets' as never]).toBeDefined()
    expect(typeof api().deploy).toBe('function')
    const statuses = await api().status()
    expect(statuses.map((s) => s.slug)).toEqual(['production', 'staging'])
    expect(statuses[0]).toMatchObject({ configured: true, paused: false, pendingCount: 0, projectId: PROJECT, tokenConfigured: true })
  })

  test('status endpoint requires a user and never leaks the hook or token', async () => {
    const anon = await call('GET', '/vercel/status', { auth: false })
    expect(anon.status).toBe(401)
    const ok = await call('GET', '/vercel/status', { query: { tick: '0' } })
    expect(ok.status).toBe(200)
    expect(ok.json.targets).toHaveLength(2)
    expect(ok.json.permissions).toEqual({ deploy: true, rollback: true })
    expect(JSON.stringify(ok.json)).not.toContain('hook_production')
    expect(JSON.stringify(ok.json)).not.toContain('test-token')
  })
})

describe('change tracking', () => {
  test('draft saves record nothing, publishing records one row per target', async () => {
    const page = await payload.create({ collection: 'pages', data: { _status: 'draft', title: 'Home' } as never, draft: true })
    expect(await pending('production')).toHaveLength(0)
    await payload.update({ id: page.id, collection: 'pages', data: { _status: 'published', title: 'Home' } as never })
    const prod = await pending('production')
    expect(prod).toHaveLength(1)
    expect(prod[0]).toMatchObject({ collection: 'pages', docId: String(page.id), operation: 'publish', saves: 1, title: 'Home' })
    expect(await pending('staging')).toHaveLength(1)
    // A second publish bumps the same row.
    await payload.update({ id: page.id, collection: 'pages', data: { _status: 'published', title: 'Home v2' } as never })
    const again = await pending('production')
    expect(again).toHaveLength(1)
    expect(again[0]).toMatchObject({ saves: 2, title: 'Home v2' })
    // Unpublish is a change too.
    await payload.update({ id: page.id, collection: 'pages', data: { _status: 'draft' } as never })
    expect((await pending('production'))[0]).toMatchObject({ operation: 'unpublish' })
    // Delete keeps the row, now as a delete.
    await payload.delete({ id: page.id, collection: 'pages' })
    expect((await pending('production'))[0]).toMatchObject({ operation: 'delete', title: 'Home v2' })
  })

  test('collections without drafts record every save, only for their targets', async () => {
    const post = await payload.create({ collection: 'posts', data: { title: 'Hello' } as never })
    expect((await pending('production'))[0]).toMatchObject({ collection: 'posts', operation: 'create', title: 'Hello' })
    expect(await pending('staging')).toHaveLength(0)
    await payload.update({ id: post.id, collection: 'posts', data: { title: 'Hello again' } as never })
    const rows = await pending('production')
    expect(rows).toHaveLength(1)
    // create stays create until deployed, whatever comes after
    expect(rows[0]).toMatchObject({ operation: 'create', saves: 2, title: 'Hello again' })
  })

  test('untracked collections and vercelSkip record nothing; globals do', async () => {
    await payload.create({ collection: 'notes', data: { text: 'x' } as never })
    await payload.create({ collection: 'posts', context: { vercelSkip: true }, data: { title: 'Import' } as never })
    expect(await pending('production')).toHaveLength(0)
    await payload.updateGlobal({ slug: 'site-settings' as never, data: { siteName: 'Acme' } as never })
    const rows = await pending('production')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ global: 'site-settings', title: 'Site settings' })
    expect(await pending('staging')).toHaveLength(1)
  })

  test('a change opens the debounce window; more changes push it out but not past maxWait', async () => {
    const before = Date.now()
    await payload.create({ collection: 'posts', data: { title: 'A' } as never })
    const s1 = await state('production')
    expect(s1.pendingSince).toBeTruthy()
    const due1 = new Date(s1.dueAt!).getTime()
    expect(due1).toBeGreaterThanOrEqual(before + 1400)
    expect(due1).toBeLessThanOrEqual(Date.now() + 1600)
    await sleep(600)
    await payload.create({ collection: 'posts', data: { title: 'B' } as never })
    const s2 = await state('production')
    expect(new Date(s2.dueAt!).getTime()).toBeGreaterThan(due1)
    expect(s2.pendingSince).toBe(s1.pendingSince)
    // maxWait = 4 s from pendingSince
    expect(new Date(s2.dueAt!).getTime()).toBeLessThanOrEqual(new Date(s1.pendingSince!).getTime() + 4000)
  })

  test('the document endpoint reports pending, deploying and live', async () => {
    const post = await payload.create({ collection: 'posts', data: { title: 'Doc' } as never })
    const q = { collection: 'posts', id: String(post.id) }
    expect((await call('GET', '/vercel/document', { query: q })).json).toEqual({ targets: { production: 'pending' }, tracked: true })
    await api().deploy({ target: 'production' })
    expect((await call('GET', '/vercel/document', { query: q })).json.targets).toEqual({ production: 'deploying' })
    mock.settle()
    await refreshUntil('production', (rows) => rows[0]?.state === 'ready')
    expect((await call('GET', '/vercel/document', { query: q })).json.targets).toEqual({ production: 'live' })
    expect((await call('GET', '/vercel/document', { query: { collection: 'notes', id: '1' } })).json.tracked).toBe(false)
  })
})

describe('triggering', () => {
  test('a tick before the window is due does nothing; after it, exactly one deployment fires and folds the changes', async () => {
    await payload.create({ collection: 'posts', data: { title: 'One' } as never })
    await payload.create({ collection: 'posts', data: { title: 'Two' } as never })
    const early = await api().tick('local')
    expect(early.triggered).toEqual([])
    expect(await deployments('production')).toHaveLength(0)

    await sleep(1700)
    // Three concurrent ticks observe the same window.
    const results = await Promise.all([api().tick('heartbeat'), api().tick('job'), api().tick('endpoint')])
    const rows = await deployments('production')
    expect(rows).toHaveLength(1)
    expect(results.flatMap((r) => r.triggered)).toEqual(['production'])
    expect(rows[0]).toMatchObject({ cause: 'auto', changeCount: 2, state: 'triggered' })
    expect(rows[0]!.changes?.counts).toEqual({ posts: 2 })
    expect(rows[0]!.changes?.items.map((i) => i.t).sort()).toEqual(['One', 'Two'])
    expect(rows[0]!.hookJobId).toMatch(/^job_/)
    expect(await pending('production')).toHaveLength(0)
    const s = await state('production')
    expect(s.dueAt).toBeNull()
    expect(s.pendingSince).toBeNull()
    expect(s.lastTriggerAt).toBeTruthy()
    expect(mock.requests.filter((r) => r.path.includes('hook_production'))).toHaveLength(1)
  })

  test('the deployment is matched to the Vercel deployment and followed to ready', async () => {
    await payload.create({ collection: 'posts', data: { title: 'Follow' } as never })
    const record = await api().deploy({ target: 'production', reason: 'test' })
    expect(record).toMatchObject({ cause: 'api', reason: 'test', state: 'triggered' })
    await sleep(3100) // the matcher waits 3 s after the hook call before its first read
    const matched = await refreshUntil('production', (rows) => Boolean(rows[0]?.deploymentId))
    expect(matched[0]!.deploymentId).toMatch(/^dpl_/)
    expect(['queued', 'building', 'ready']).toContain(matched[0]!.state)
    mock.settle()
    const done = await refreshUntil('production', (rows) => rows[0]?.state === 'ready')
    expect(done[0]).toMatchObject({ environment: 'production', state: 'ready' })
    expect(done[0]!.deploymentUrl).toMatch(/^https:\/\/mock-site-/)
    expect(done[0]!.durationMs).toBeGreaterThanOrEqual(0)
    const status = await api().status('production')
    expect(status.current?.deploymentId).toBe(done[0]!.deploymentId)
    expect(status.pendingCount).toBe(0)
  })

  test('the manual endpoint records the user; the hourly limit only stops automatic triggers', async () => {
    const res = await call('POST', '/vercel/deploy', { body: { reason: 'Ship it', target: 'staging' } })
    expect(res.status).toBe(200)
    expect(res.json.deployment).toMatchObject({ cause: 'manual', reason: 'Ship it', target: 'staging' })
    expect(res.json.deployment.triggeredBy).toBeTruthy()

    const s = await state('production')
    const times = Array.from({ length: 60 }, (_, i) => new Date(Date.now() - i * 1000).toISOString())
    await payload.update({ id: s.id, collection: 'vercel-targets', data: { dueAt: new Date(Date.now() - 1000).toISOString(), triggerTimes: times } as never, overrideAccess: true })
    const result = await api().tick('local')
    expect(result.triggered).toEqual([])
    expect(result.errors.join(' ')).toMatch(/60 deploy-hook triggers/)
    expect(await deployments('production')).toHaveLength(0)
    const manual = await api().deploy({ target: 'production' })
    expect(manual.state).toBe('triggered')
    expect((await api().status('production')).triggersLastHour).toBe(61)
  })

  test('a failed hook call marks the row error and puts the changes back', async () => {
    await payload.create({ collection: 'posts', data: { title: 'Back' } as never })
    await fetch(`${process.env.VERCEL_API_BASE}/__mock/config`, { body: JSON.stringify({ hookStatus: 500 }), method: 'POST' })
    const record = await api().deploy({ target: 'production' })
    expect(record.state).toBe('error')
    expect(record.errorMessage).toMatch(/500/)
    const rows = await pending('production')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.title).toBe('Back')
    expect((await state('production')).dueAt).toBeTruthy()
    // two attempts: one retry on 5xx
    expect(mock.requests.filter((r) => r.path.includes('hook_production'))).toHaveLength(2)
  })

  test('a failed build re-instates the changes; a superseded build does not', async () => {
    await payload.create({ collection: 'posts', data: { title: 'Broken' } as never })
    await fetch(`${process.env.VERCEL_API_BASE}/__mock/config`, { body: JSON.stringify({ failNext: 1 }), method: 'POST' })
    await api().deploy({ target: 'production' })
    await sleep(3100)
    const failed = await refreshUntil('production', (rows) => rows[0]?.state === 'error')
    expect(failed[0]).toMatchObject({ errorCode: 'BUILD_FAILED', state: 'error' })
    expect((await pending('production')).map((r) => r.title)).toEqual(['Broken'])

    await resetAll()
    await payload.create({ collection: 'posts', data: { title: 'First' } as never })
    const first = await api().deploy({ target: 'production' })
    await payload.create({ collection: 'posts', data: { title: 'Second' } as never })
    const second = await api().deploy({ target: 'production' })
    expect(second.changeCount).toBe(1)
    await sleep(3100)
    mock.settle()
    const rows = await refreshUntil('production', (r) => r.every((x) => ['ready', 'canceled'].includes(x.state)))
    const firstRow = rows.find((r) => r.id === first.id)!
    const secondRow = rows.find((r) => r.id === second.id)!
    expect(firstRow.state).toBe('canceled')
    expect(firstRow.supersededBy).toBeTruthy()
    expect(secondRow.state).toBe('ready')
    expect(await pending('production')).toHaveLength(0)
  })

  test('flush fires a pending window immediately with the window key; pause stops it', async () => {
    await payload.create({ collection: 'posts', data: { title: 'Flush me' } as never })
    const before = await state('production')
    const flushed = await call('POST', '/vercel/flush')
    expect(flushed.json.fired).toEqual(['production'])
    const rows = await deployments('production')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.dedupeKey).toBe(`production:auto:${new Date(before.dueAt!).getTime()}`)
    // a later tick for the same window is a no-op
    await sleep(50)
    expect((await api().tick('local')).triggered).toEqual([])

    await call('PATCH', '/vercel/pause', { body: { paused: true, target: 'production' } })
    await payload.create({ collection: 'posts', data: { title: 'While paused' } as never })
    expect((await state('production')).dueAt).toBeNull()
    expect(await pending('production')).toHaveLength(1)
    await sleep(1700)
    expect((await api().tick('local')).triggered).toEqual([])
    await call('PATCH', '/vercel/pause', { body: { paused: false, target: 'production' } })
    expect((await state('production')).dueAt).toBeTruthy()
  })

  test('the tick endpoint accepts the shared secret without a session', async () => {
    const denied = await call('POST', '/vercel/tick', { auth: false })
    expect(denied.status).toBe(401)
    const ok = await call('POST', '/vercel/tick', { auth: false, headers: { 'x-vercel-plugin-secret': TICK_SECRET } })
    expect(ok.status).toBe(200)
    expect(ok.json.source).toBe('endpoint')
  })
})

describe('cancel, rollback, external, webhook, retention', () => {
  test('cancel marks the row canceled and re-instates its changes', async () => {
    // A long build so the deployment is still in flight when we cancel it.
    await fetch(`${process.env.VERCEL_API_BASE}/__mock/config`, { body: JSON.stringify({ buildDelayMs: 100, buildTimeMs: 60_000 }), method: 'POST' })
    await payload.create({ collection: 'posts', data: { title: 'Cancel me' } as never })
    await api().deploy({ target: 'production' })
    await sleep(3100)
    const matched = await refreshUntil('production', (rows) => Boolean(rows[0]?.deploymentId))
    const res = await call('POST', '/vercel/cancel', { body: { deploymentId: matched[0]!.deploymentId } })
    expect(res.status).toBe(200)
    expect(res.json.deployment.state).toBe('canceled')
    expect((await pending('production')).map((r) => r.title)).toEqual(['Cancel me'])
  })

  test('rollback records a row, moves the current pointer and re-instates newer changes', async () => {
    await payload.create({ collection: 'posts', data: { title: 'v1' } as never })
    await api().deploy({ target: 'production' })
    await sleep(3100)
    mock.settle()
    const v1 = await refreshUntil('production', (rows) => rows[0]?.state === 'ready')
    const v1Id = v1[0]!.deploymentId!
    await sleep(20)
    await payload.create({ collection: 'posts', data: { title: 'v2' } as never })
    await api().deploy({ target: 'production' })
    await sleep(3100)
    mock.settle()
    const v2 = await refreshUntil('production', (rows) => rows[0]?.state === 'ready' && rows[0].deploymentId !== v1Id)
    expect((await api().status('production')).current?.deploymentId).toBe(v2[0]!.deploymentId)

    const candidates = await call('GET', '/vercel/rollback-candidates', { query: { target: 'production' } })
    expect(candidates.json.candidates.map((c: any) => c.uid)).toContain(v1Id)

    const res = await call('POST', '/vercel/rollback', { body: { target: 'production', toDeploymentId: v1Id } })
    expect(res.status).toBe(200)
    expect(res.json.deployment).toMatchObject({ cause: 'rollback', rollbackTo: v1Id, state: 'ready' })
    expect(mock.rollbacks).toEqual([v1Id])
    expect((await api().status('production')).current?.deploymentId).toBe(v1Id)
    expect((await pending('production')).map((r) => r.title)).toEqual(['v2'])
  })

  test('deployments nobody triggered through Payload are recorded as external', async () => {
    await fetch(`${process.env.VERCEL_API_BASE}/__mock/external`, { body: JSON.stringify({ projectId: PROJECT }), method: 'POST' })
    mock.settle()
    await api().tick('local')
    const rows = await deployments('production')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ cause: 'external', state: 'ready' })
    expect((await api().status('production')).current?.deploymentId).toBe(rows[0]!.deploymentId)
  })

  test('webhook: signature required, duplicates ignored, events update the ledger', async () => {
    await payload.create({ collection: 'posts', data: { title: 'Hooked' } as never })
    const record = await api().deploy({ target: 'production' })
    const deployment = mock.deployments.at(-1)!
    const event = (type: string, id: string) => ({
      createdAt: Date.now(),
      id,
      payload: { deployment: { id: deployment.uid, name: 'mock-site', url: deployment.url }, links: { deployment: deployment.inspectorUrl }, project: { id: PROJECT }, target: 'production' },
      type,
    })
    const send = async (body: object, signature?: string) => {
      const raw = JSON.stringify(body)
      const request = new Request('http://localhost:3400/api/vercel/webhook', {
        body: raw,
        headers: { 'content-type': 'application/json', 'x-vercel-signature': signature ?? signVercelPayload(raw, WEBHOOK_SECRET) },
        method: 'POST',
      })
      const req = await createPayloadRequest({ config, request })
      const res = await endpoint('post', '/vercel/webhook').handler(req)
      return { json: (await res.json()) as any, status: res.status }
    }
    expect((await send(event('deployment.created', 'evt_1'), 'deadbeef')).status).toBe(403)
    expect((await send(event('deployment.created', 'evt_1'))).json).toEqual({ ok: true })
    expect((await send(event('deployment.created', 'evt_1'))).json).toEqual({ ignored: 'duplicate' })
    let rows = await deployments('production')
    expect(rows[0]).toMatchObject({ deploymentId: deployment.uid, id: record.id, state: 'queued' })
    expect((await send(event('deployment.succeeded', 'evt_2'))).json).toEqual({ ok: true })
    rows = await deployments('production')
    expect(rows[0]!.state).toBe('ready')
    expect((await api().status('production')).current?.deploymentId).toBe(deployment.uid)
    // an event for a project we do not know is acknowledged and ignored
    const foreign = event('deployment.error', 'evt_3')
    foreign.payload.project.id = 'prj_other'
    expect((await send(foreign)).json).toEqual({ ok: true })
    expect((await deployments('production'))[0]!.state).toBe('ready')
  })

  test('retention drops old and surplus finished rows, never in-flight ones', async () => {
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString()
    for (let i = 0; i < 8; i++) {
      const row = await payload.create({
        collection: 'vercel-deployments',
        data: { cause: 'external', dedupeKey: `production:old:${i}`, state: i === 0 ? 'building' : 'ready', target: 'production' } as never,
        overrideAccess: true,
      })
      if (i < 3) {
        await payload.db.updateOne({ id: row.id, collection: 'vercel-deployments', data: { createdAt: old } })
      }
    }
    const removed = await (await import('../src/deploy/tick.js')).applyRetention({ clients: new Map(), options: api().options, payload } as never, 'production')
    const rows = await deployments('production')
    // in-flight rows are exempt; finished rows are capped at `keep`
    expect(rows.some((r) => r.state === 'building')).toBe(true)
    expect(rows.filter((r) => r.state !== 'building')).toHaveLength(5)
    expect(removed).toBe(2)
  })
})
