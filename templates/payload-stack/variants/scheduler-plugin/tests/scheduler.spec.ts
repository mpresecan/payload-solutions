/**
 * src/scheduler: the seam between a project with the Payload Action Scheduler and one without.
 *
 * No database and no job runner here. These are the checks that catch what actually goes wrong
 * when a scheduler is wired into a product: an action registered for a feature the product does
 * not have, a recurring series pointing at a hook nobody defined, a webhook wrapper that quietly
 * replaced the email one, and a run endpoint that anybody on the internet can call.
 */
import type { Config, Plugin } from 'payload'
import type Stripe from 'stripe'
import { describe, expect, it, vi } from 'vitest'

import { base, presetEntries, presets } from '../helpers/stack-fixtures'
import { loadWithEnv, loadWithStack, toStack } from '../helpers/with-stack'

type AnyConfig = Config & {
  collections: Array<{ slug: string }>
  globals: Array<{ slug: string }>
  jobs?: { tasks?: Array<{ schedule?: unknown; slug: string }> }
  typescript?: { schema?: unknown[] }
}

const emptyConfig = () => ({ collections: [], globals: [] }) as unknown as Config

/** Applies the stack's scheduler plugins to an empty Payload config, under the given stack.config.ts. */
async function apply(input = base) {
  const stack = toStack(input)
  const loaded = await loadWithStack(stack, async () => {
    const seam = await import('@/scheduler/plugin')
    const catalogue = await import('@/scheduler/actions')
    return { ...seam, ...catalogue }
  })
  const config = loaded.schedulerPlugins.reduce<Config>(
    (acc, plugin) => (plugin as Plugin)(acc) as Config,
    emptyConfig(),
  ) as AnyConfig
  return { ...loaded, config, stack }
}

const slugsOf = (input = base) => apply(input).then(({ actions }) => actions.map((a) => a.slug))

describe('registration', () => {
  it('adds the ledger, its log, the status global and both tasks', async () => {
    const { config } = await apply()
    expect(config.collections.map((c) => c.slug)).toEqual(
      expect.arrayContaining(['scheduled-actions', 'scheduled-action-logs']),
    )
    expect(config.globals.map((g) => g.slug)).toContain('scheduler-status')

    const tasks = config.jobs?.tasks ?? []
    expect(tasks.map((t) => t.slug)).toEqual(expect.arrayContaining(['scheduler:run', 'scheduler:tick']))
    // The tick is the only task with a schedule of its own; the run task is dispatched per action.
    expect(tasks.find((t) => t.slug === 'scheduler:tick')?.schedule).toBeTruthy()
    expect(tasks.find((t) => t.slug === 'scheduler:run')?.schedule).toBeUndefined()
  })

  it('contributes a typescript schema, so args are generated types and not `unknown`', async () => {
    const { config } = await apply()
    expect((config.typescript?.schema ?? []).length).toBeGreaterThan(0)
  })

  it('keeps the ledger to admins: arguments hold customer data', async () => {
    const { schedulerPlugins } = await apply()
    const source = schedulerPlugins.toString()
    expect(source).not.toContain('anyone')
  })
})

describe('the catalogue', () => {
  it('registers unique, valid definitions', async () => {
    const { actions } = await apply(presets['billing-org'])
    const slugs = actions.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const action of actions) {
      expect(action.slug).toMatch(/^[a-z0-9]+([.\-_][a-z0-9]+)*$/)
      expect(typeof action.handler).toBe('function')
      expect(action.label).toBeTruthy()
      expect(action.description).toBeTruthy()
      expect(action.inputSchema).toBeDefined()
    }
  })

  it('prunes auth records whatever the product sells', async () => {
    for (const [, input] of presetEntries) {
      expect(await slugsOf(input)).toContain('maintenance.prune-auth-records')
    }
  })

  it('only sweeps invitations when there are organizations', async () => {
    expect(await slugsOf(presets['billing-org'])).toContain('organizations.expire-invitations')
    expect(await slugsOf(presets['orgs-off'])).not.toContain('organizations.expire-invitations')
  })

  it('leaves out the billing notices without billing', async () => {
    const withBilling = await slugsOf(presets['billing-org'])
    expect(withBilling).toContain('billing.trial-reminder')
    expect(withBilling).toContain('billing.payment-reminder')

    const none = await slugsOf(presets['magic-link-only'])
    expect(none).not.toContain('billing.trial-reminder')
    expect(none).not.toContain('billing.payment-reminder')
  })

  it('ships the account purge unarmed, because it deletes people', async () => {
    const { actions, recurring } = await apply(presets['billing-org'])
    const purge = actions.find((a) => a.slug === 'accounts.purge-unverified')
    expect(purge).toBeDefined()
    // Registered, so it can be run from the admin — but no series arms it, and it never retries.
    expect(recurring.map((r) => r.hook)).not.toContain('accounts.purge-unverified')
    expect(purge!.retries).toBe(0)
    expect(purge!.description).toMatch(/destructive/i)
  })
})

describe('recurring series', () => {
  it('name a registered action, with a unique key and a real cron', async () => {
    const { actions, recurring } = await apply(presets['billing-org'])
    const known = new Set(actions.map((a) => a.slug))
    const keys = new Set<string>()
    for (const series of recurring) {
      expect(known.has(series.hook), series.hook).toBe(true)
      expect(keys.has(series.key), series.key).toBe(false)
      keys.add(series.key)
      expect(series.cron ?? '').toMatch(/^(\S+\s+){4}\S+$/)
    }
    expect(recurring.length).toBeGreaterThan(0)
  })

  it('drops the invitation sweep with organizations off', async () => {
    const { recurring } = await apply(presets['orgs-off'])
    expect(recurring.map((r) => r.key)).toEqual(['prune-auth-records'])
  })
})

describe('Better Auth wrappers', () => {
  const load = () => loadWithStack(base, () => import('@/scheduler/hooks'))

  it('chains its Stripe handler after the email one instead of replacing it', async () => {
    const { withStripeEvents } = await load()
    const seen: string[] = []
    const wrapped = withStripeEvents({
      onEvent: async () => {
        seen.push('emails')
      },
    })
    // An event neither side acts on still has to reach the email handler.
    await wrapped.onEvent({ data: { object: {} }, type: 'customer.created' } as unknown as Stripe.Event)
    expect(seen).toEqual(['emails'])
  })

  it('survives a bundle with no handler of its own', async () => {
    const { withStripeEvents } = await load()
    const wrapped = withStripeEvents({})
    await expect(
      wrapped.onEvent({ data: { object: {} }, type: 'customer.created' } as unknown as Stripe.Event),
    ).resolves.toBeUndefined()
  })

  it('moves the trial notice earlier rather than sending it twice', async () => {
    const { withTrialCallbacks } = await load()
    const wrapped = withTrialCallbacks({ onTrialEnd: async () => {}, onTrialExpired: async () => {} }) as Record<
      string,
      unknown
    >
    expect(wrapped.onTrialStart).toBeTypeOf('function')
    // The day-of send is the scheduler's job now, from three days out.
    expect(wrapped.onTrialEnd).toBeUndefined()
    // Nothing was charged is still a fact only the event knows.
    expect(wrapped.onTrialExpired).toBeTypeOf('function')
  })

  it('never throws out of a Better Auth callback', async () => {
    const { withTrialCallbacks } = await load()
    const { onTrialStart } = withTrialCallbacks({})
    // No reference and no trial end: nothing to schedule, and no exception into the checkout.
    await expect(onTrialStart({ plan: 'team' })).resolves.toBeUndefined()
    await expect(onTrialStart({ plan: 'team', referenceId: '1', trialEnd: 'not a date' })).resolves.toBeUndefined()
  })
})

describe('the run endpoint', () => {
  const request = (authorization?: string, user?: unknown) =>
    ({ headers: new Headers(authorization ? { authorization } : {}), user: user ?? null }) as never

  async function jobs(env: Record<string, string | undefined> = {}) {
    return (await loadWithEnv({ CRON_SECRET: undefined, RUN_JOBS_IN_PROCESS: undefined, ...env }, () =>
      import('@/scheduler/jobs'),
    )).schedulerJobs!
  }

  it('lets the cron secret in, and nothing else pretending to be it', async () => {
    const config = await jobs({ CRON_SECRET: 'sh-secret' })
    const run = config.access!.run!
    expect(await run({ req: request('Bearer sh-secret') })).toBe(true)
    expect(await run({ req: request('Bearer wrong') })).toBe(false)
    expect(await run({ req: request('sh-secret') })).toBe(false)
    expect(await run({ req: request() })).toBe(false)
  })

  it('lets an admin run the queue by hand, and no other signed-in user', async () => {
    const config = await jobs()
    const run = config.access!.run!
    expect(await run({ req: request(undefined, { id: 1, role: ['admin'] }) })).toBe(true)
    expect(await run({ req: request(undefined, { id: 2, role: ['user'] }) })).toBe(false)
    expect(await run({ req: request() })).toBe(false)
  })

  it('runs nothing in process unless asked, because that is wrong on serverless', async () => {
    expect((await jobs()).autoRun).toEqual([])
    const inProcess = await jobs({ RUN_JOBS_IN_PROCESS: 'true' })
    expect(inProcess.autoRun).toEqual([{ allQueues: true, cron: '* * * * *' }])
    expect(await inProcess.shouldAutoRun!({} as never)).toBe(true)
    expect(await (await jobs()).shouldAutoRun!({} as never)).toBe(false)
  })
})

describe('housekeeping handlers', () => {
  const context = { attempt: 1, group: 'maintenance', hook: 'x', id: 1, maxAttempts: 1, recurring: true, runCount: 0, scheduleAt: new Date() }
  const run = async (
    action: { handler: (args: never) => unknown },
    payload: Record<string, unknown>,
    args: Record<string, unknown> = {},
  ) =>
    action.handler({
      action: context,
      args,
      log: () => {},
      payload,
      req: {},
      signal: new AbortController().signal,
    } as never)

  it('deletes expired sessions and verifications, and says how many', async () => {
    const { pruneAuthRecords } = await loadWithStack(base, () => import('@/scheduler/actions/maintenance'))
    const deleted: string[] = []
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => ({
        docs: collection === 'sessions' ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
      })),
      delete: vi.fn(async ({ collection }: { collection: string }) => {
        deleted.push(collection)
      }),
    }
    const result = (await run(pruneAuthRecords, payload)) as { note: string }
    expect(deleted).toEqual(['sessions', 'sessions', 'verifications'])
    expect(result.note).toContain('2 sessions')
    // Only ever expired rows: a live session must survive its own housekeeping.
    for (const [call] of payload.find.mock.calls as unknown as Array<[{ where: { expiresAt: { less_than: string } } }]>) {
      expect(call.where.expiresAt.less_than).toBeTruthy()
    }
  })

  it('expires invitations rather than deleting them', async () => {
    const { expireInvitations } = await loadWithStack(base, () => import('@/scheduler/actions/maintenance'))
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 7 }] })),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    }
    await run(expireInvitations, payload)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'invitations', data: { status: 'expired' }, id: 7 }),
    )
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('never purges an administrator, and skips a run with nothing to do', async () => {
    const { purgeUnverified } = await loadWithStack(base, () => import('@/scheduler/actions/maintenance'))
    const payload = { find: vi.fn(async () => ({ docs: [] })), delete: vi.fn(async () => ({})) }
    await expect(run(purgeUnverified, payload, { olderThanDays: 30 })).rejects.toThrow(/No unverified account/)
    expect(payload.delete).not.toHaveBeenCalled()

    const [firstCall] = payload.find.mock.calls as unknown as Array<[{ where: { and: unknown[] } }]>
    const where = firstCall![0].where
    expect(JSON.stringify(where)).toContain('admin')
    expect(JSON.stringify(where)).toContain('emailVerified')
  })
})
