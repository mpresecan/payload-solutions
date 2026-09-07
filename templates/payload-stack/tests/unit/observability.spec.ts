/**
 * src/lib/observability: the provider-agnostic error port.
 *
 * The guarantees pinned here are the ones every caller relies on without checking: the facade never
 * throws, secrets and personal data are removed before any adapter sees them, and swapping the
 * provider changes nothing about what the rest of the template calls.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSentryAdapter, type SentryLike } from '@/lib/observability/adapters/sentry'
import { redactContext, REDACTED } from '@/lib/observability/redact'
import { defineStack } from '@/lib/stack'
import type { ErrorContext, ObservabilityAdapter } from '@/lib/observability/types'
import { base } from '../helpers/stack-fixtures'
import { loadWithEnv, loadWithStack } from '../helpers/with-stack'

/** Records everything an adapter is handed, so tests can assert on the scrubbed payload. */
function recordingAdapter(): ObservabilityAdapter & { events: { error: unknown; context?: ErrorContext }[] } {
  const events: { error: unknown; context?: ErrorContext }[] = []
  return {
    name: 'recording',
    events,
    captureError(error, context) {
      events.push({ error, context })
    },
    captureMessage() {},
    identify() {},
    async flush() {},
  }
}

const loadFacade = (stackInput = base) =>
  loadWithStack(stackInput, async () => {
    const facade = await import('@/lib/observability')
    const registry = await import('@/lib/observability/registry')
    return { ...facade, ...registry }
  })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('stack.config observability policy', () => {
  it('defaults to no PII, unsampled errors and a low trace rate', () => {
    expect(defineStack(base).observability).toEqual({
      sampleRate: 1,
      tracesSampleRate: 0.1,
      sendPII: false,
    })
  })

  it('rejects a sample rate outside 0–1', () => {
    expect(() => defineStack({ ...base, observability: { sampleRate: 2 } })).toThrow(/observability\.sampleRate/)
  })
})

describe('redaction', () => {
  const context: ErrorContext = {
    user: { id: 'user_1', orgId: 'org_1', plan: 'team', email: 'ada@example.com', name: 'Ada' },
    tags: { plan: 'team' },
    extra: { stripeSecret: 'sk_live_1', nested: { authorization: 'Bearer x', ok: 'kept' } },
    request: { method: 'POST', path: '/api/x', headers: { cookie: 'session=1', 'user-agent': 'vitest' } },
  }

  it('drops name, email and every secret-looking key when sendPII is false', () => {
    const safe = redactContext(context, false)!
    expect(safe.user).toEqual({ id: 'user_1', orgId: 'org_1', plan: 'team' })
    expect(safe.extra).toEqual({ stripeSecret: REDACTED, nested: { authorization: REDACTED, ok: 'kept' } })
  })

  it('keeps identifying fields only when sendPII is explicitly on', () => {
    expect(redactContext(context, true)!.user).toMatchObject({ email: 'ada@example.com', name: 'Ada' })
  })

  it('allows only known-safe request headers through', () => {
    expect(redactContext(context, false)!.request!.headers).toEqual({ 'user-agent': 'vitest' })
  })

  it('truncates deep structures instead of walking them forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too far' } } } } } }
    expect(redactContext({ extra: deep }, false)!.extra).toEqual({ a: { b: { c: { d: { e: '[truncated]' } } } } })
  })
})

describe('facade', () => {
  it('hands the scrubbed context to whichever adapter is registered', async () => {
    const { captureError, setObservabilityAdapter } = await loadFacade()
    const adapter = recordingAdapter()
    setObservabilityAdapter(adapter)

    const error = new Error('boom')
    captureError(error, { source: 'test', extra: { password: 'hunter2' } })

    expect(adapter.events).toHaveLength(1)
    expect(adapter.events[0]!.error).toBe(error)
    expect(adapter.events[0]!.context!.extra).toEqual({ password: REDACTED })
    setObservabilityAdapter(null)
  })

  it('swallows an adapter that throws — monitoring must never break a request', async () => {
    const { captureError, setObservabilityAdapter } = await loadFacade()
    setObservabilityAdapter({
      name: 'broken',
      captureError() {
        throw new Error('provider is down')
      },
    })

    expect(() => captureError(new Error('boom'))).not.toThrow()
    setObservabilityAdapter(null)
  })

  it('never samples errors away, however low the rate', async () => {
    const { captureError, captureMessage, setObservabilityAdapter } = await loadFacade({
      ...base,
      observability: { sampleRate: 0 },
    })
    const adapter = recordingAdapter()
    setObservabilityAdapter(adapter)
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    captureError(new Error('boom'))
    captureMessage('just so you know', 'info')

    expect(adapter.events).toHaveLength(1)
    setObservabilityAdapter(null)
  })

  it('reports through withErrorReporting and rethrows unchanged', async () => {
    const { withErrorReporting, setObservabilityAdapter } = await loadFacade()
    const adapter = recordingAdapter()
    setObservabilityAdapter(adapter)

    const handler = withErrorReporting('stripe-webhook', async () => {
      throw new Error('signature mismatch')
    })

    await expect(handler()).rejects.toThrow('signature mismatch')
    expect(adapter.events[0]!.context!.source).toBe('stripe-webhook')
    setObservabilityAdapter(null)
  })

  it('falls back to console in development and to nothing in production', async () => {
    const { observabilityProvider } = await loadFacade()
    expect(observabilityProvider()).toBe('console')

    vi.stubEnv('NODE_ENV', 'production')
    const production = await loadFacade()
    expect(production.observabilityProvider()).toBe('none')
  })
})

describe('sentry adapter', () => {
  function fakeSentry() {
    const calls: { exceptions: [unknown, Record<string, unknown> | undefined][]; users: unknown[] } = {
      exceptions: [],
      users: [],
    }
    const Sentry: SentryLike = {
      captureException(error, captureContext) {
        calls.exceptions.push([error, captureContext])
        return 'event-id'
      },
      captureMessage: () => 'event-id',
      setUser(user) {
        calls.users.push(user)
      },
      flush: async () => true,
    }
    return { Sentry, calls }
  }

  it('maps our context onto Sentry scope fields', () => {
    const { Sentry, calls } = fakeSentry()
    createSentryAdapter(Sentry).captureError(new Error('boom'), {
      source: 'payload',
      user: { id: 'user_1', orgId: 'org_1', plan: 'team' },
      request: { routePath: '/dashboard', routeType: 'render' },
    })

    const [, scope] = calls.exceptions[0]!
    expect(scope).toMatchObject({
      level: 'error',
      user: { id: 'user_1' },
      tags: { source: 'payload', org_id: 'org_1', plan: 'team', route: '/dashboard', route_type: 'render' },
    })
  })

  it('clears the user on sign-out', () => {
    const { Sentry, calls } = fakeSentry()
    createSentryAdapter(Sentry).identify!(null)
    expect(calls.users).toEqual([null])
  })
})

describe('env', () => {
  const required = { DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/app', PAYLOAD_SECRET: 'a-secret' }

  it('stays off until a DSN is set', async () => {
    const { sentryReady, sentryBuildReady } = await loadWithEnv(
      { ...required, SENTRY_DSN: undefined, SENTRY_ORG: undefined },
      () => import('@/lib/env'),
    )
    expect(sentryReady).toBe(false)
    expect(sentryBuildReady).toBe(false)
  })

  it('separates reporting from the build-time source map upload', async () => {
    const { sentryReady, sentryBuildReady } = await loadWithEnv(
      { ...required, SENTRY_DSN: 'https://key@example.test/1', SENTRY_ORG: undefined },
      () => import('@/lib/env'),
    )
    expect(sentryReady).toBe(true)
    expect(sentryBuildReady).toBe(false)
  })
})
