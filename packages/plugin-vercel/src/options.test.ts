import { describe, expect, test } from 'vitest'

import { parseHookUrl, sanitizeOptions } from './options.js'

const hook = (id: string) => `https://api.vercel.com/v1/integrations/deploy/prj_98g22o5YUFVHlKOzj9vKPTyN2SDG/${id}`

describe('parseHookUrl', () => {
  test('extracts the project and hook ids from a deploy hook URL', () => {
    expect(parseHookUrl(hook('tKybBxqhQs'))).toEqual({ hookId: 'tKybBxqhQs', projectId: 'prj_98g22o5YUFVHlKOzj9vKPTyN2SDG' })
    expect(parseHookUrl(`${hook('abc')}?buildCache=false`)).toMatchObject({ hookId: 'abc' })
    expect(parseHookUrl('http://localhost:3399/v1/integrations/deploy/prj_dev/hook_production')).toEqual({ hookId: 'hook_production', projectId: 'prj_dev' })
  })

  test('rejects anything else', () => {
    expect(parseHookUrl(undefined)).toBeNull()
    expect(parseHookUrl('')).toBeNull()
    expect(parseHookUrl('https://api.vercel.com/v7/deployments')).toBeNull()
    expect(parseHookUrl('not a url')).toBeNull()
  })
})

describe('sanitizeOptions', () => {
  test('applies defaults and derives projectId from the hook', () => {
    const options = sanitizeOptions({ targets: [{ slug: 'production', hook: hook('x') }] })
    expect(options.targets[0]).toMatchObject({ buildCache: true, configured: true, label: 'production', projectId: 'prj_98g22o5YUFVHlKOzj9vKPTyN2SDG', slug: 'production' })
    expect(options.autoDeploy).toEqual({ maxWaitMs: 600_000, quietPeriodMs: 60_000 })
    expect(options.retention).toEqual({ days: 90, keep: 200 })
    expect(options.tick).toMatchObject({ adminHeartbeat: true, beacon: true, job: { cron: '* * * * *', queue: 'vercel' } })
    expect(options.admin.view).toEqual({ path: '/deployments' })
    expect(options.slugs).toEqual({ changes: 'vercel-changes', deployments: 'vercel-deployments', targets: 'vercel-targets' })
    expect(options.apiBase).toBe('https://api.vercel.com')
  })

  test('a missing hook registers a not-configured target instead of throwing', () => {
    const options = sanitizeOptions({ targets: [{ slug: 'staging', hook: process.env.DEFINITELY_UNSET_VAR }] })
    expect(options.targets[0]).toMatchObject({ configured: false, projectId: undefined })
  })

  test('plugin-level token and team flow into targets, per-target values win', () => {
    const options = sanitizeOptions({
      targets: [
        { slug: 'a', hook: hook('a') },
        { slug: 'b', hook: hook('b'), teamId: 'team_b', token: 'tok_b' },
      ],
      teamId: 'team_x',
      token: 'tok_x',
    })
    expect(options.targets.map((t) => [t.token, t.teamId])).toEqual([
      ['tok_x', 'team_x'],
      ['tok_b', 'team_b'],
    ])
  })

  test('durations accept strings and numbers; maxWait must not be shorter than the quiet period', () => {
    expect(sanitizeOptions({ autoDeploy: { maxWait: '2m', quietPeriod: 5000 }, targets: [{ slug: 'p' }] }).autoDeploy).toEqual({ maxWaitMs: 120_000, quietPeriodMs: 5000 })
    expect(() => sanitizeOptions({ autoDeploy: { maxWait: '10s', quietPeriod: '1m' }, targets: [{ slug: 'p' }] })).toThrow(/maxWait/)
    expect(sanitizeOptions({ autoDeploy: false, targets: [{ slug: 'p' }] }).autoDeploy).toBe(false)
  })

  test('validates target slugs, duplicates, hook URLs and target references', () => {
    expect(() => sanitizeOptions({ targets: [] })).toThrow(/At least one target/)
    expect(() => sanitizeOptions({ targets: [{ slug: 'bad slug' }] })).toThrow(/invalid/)
    expect(() => sanitizeOptions({ targets: [{ slug: 'a' }, { slug: 'a' }] })).toThrow(/Duplicate/)
    expect(() => sanitizeOptions({ targets: [{ slug: 'a', hook: 'https://example.com/hook' }] })).toThrow(/deploy hook URL/)
    expect(() => sanitizeOptions({ collections: { pages: { targets: ['nope'] } } as never, targets: [{ slug: 'a' }] })).toThrow(/unknown target "nope"/)
  })

  test('collections default to publish semantics only when the host collection has drafts', () => {
    const config = {
      collections: [
        { slug: 'pages', fields: [], versions: { drafts: true } },
        { slug: 'posts', fields: [] },
      ],
      globals: [{ slug: 'header', fields: [] }],
    }
    const options = sanitizeOptions({ collections: { pages: true, posts: true } as never, globals: { header: true } as never, targets: [{ slug: 'p' }] }, config as never)
    expect(options.collections).toEqual({ pages: { on: 'publish', targets: ['p'] }, posts: { on: 'change', targets: ['p'] } })
    expect(options.globals).toEqual({ header: { targets: ['p'] } })
    expect(() => sanitizeOptions({ collections: { missing: true } as never, targets: [{ slug: 'p' }] }, config as never)).toThrow(/no collection/)
  })
})
