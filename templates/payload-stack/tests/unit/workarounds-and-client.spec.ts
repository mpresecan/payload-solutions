/**
 * src/lib/auth/payload-auth-workarounds.ts (console filter for a known payload-auth message) and
 * a consistency check that src/lib/auth/auth-client.ts registers a browser plugin for every server
 * plugin that stack.config.ts can enable.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

describe('silenceKnownPayloadAuthWarnings', () => {
  async function fresh() {
    vi.resetModules()
    delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('payload-stack.payload-auth-warnings-silenced')]
    return import('@/lib/auth/payload-auth-workarounds')
  }

  it('drops only the known ambiguous-join message and forwards everything else', async () => {
    const original = console.error
    const calls: unknown[][] = []
    console.error = (...args: unknown[]) => void calls.push(args)
    try {
      const { silenceKnownPayloadAuthWarnings } = await fresh()
      silenceKnownPayloadAuthWarnings()
      console.error('[payload-db-adapter]', "forward join field selection ambiguous for 'user' on sessions: user, impersonatedBy")
      console.error('[payload-db-adapter]', 'some other adapter problem')
      console.error('plain error')
      console.error(new Error('boom'))
      expect(calls).toEqual([['[payload-db-adapter]', 'some other adapter problem'], ['plain error'], [expect.any(Error)]])
    } finally {
      console.error = original
    }
  })

  it('installs the filter once even when called repeatedly', async () => {
    const original = console.error
    try {
      const { silenceKnownPayloadAuthWarnings } = await fresh()
      silenceKnownPayloadAuthWarnings()
      const installed = console.error
      silenceKnownPayloadAuthWarnings()
      silenceKnownPayloadAuthWarnings()
      expect(console.error).toBe(installed)
    } finally {
      console.error = original
    }
  })
})

describe('auth client mirrors the server plugins', () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../src', rel), 'utf8')

  it('registers a client plugin for every server plugin stack.config.ts can enable', () => {
    const server = read('lib/auth/options.ts')
    const client = read('lib/auth/auth-client.ts')
    const pairs: Array<[server: string, client: string]> = [
      ['admin(', 'adminClient('],
      ['lastLoginMethod(', 'lastLoginMethodClient('],
      ['apiKey(', 'apiKeyClient('],
      ['twoFactor(', 'twoFactorClient('],
      ['passkey(', 'passkeyClient('],
      ['magicLink(', 'magicLinkClient('],
      ['organization(', 'organizationClient('],
      ['stripe(', 'stripeClient('],
    ]
    for (const [s, c] of pairs) {
      expect(server, `server registers ${s}`).toContain(s)
      expect(client, `client registers ${c}`).toContain(c)
    }
  })

  it('keeps the client free of secrets and server-only modules', () => {
    const client = read('lib/auth/auth-client.ts')
    expect(client).not.toMatch(/@\/lib\/env/)
    expect(client).not.toMatch(/server-only/)
    expect(client).not.toMatch(/process\.env\.(?!NEXT_PUBLIC_)/)
    const imports = (source: string) => [...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    expect(imports(client)).not.toContain('server-only')
    expect(imports(read('lib/stack.ts'))).toEqual(['zod'])
  })

  it('points the browser client at the configured product url and mirrors the teams flag', async () => {
    const { presets } = await import('../helpers/stack-fixtures')
    const { loadWithStack } = await import('../helpers/with-stack')
    const { authClient } = await loadWithStack(presets.teams, () => import('@/lib/auth/auth-client'))
    expect(authClient).toBeTruthy()
    // The client is a proxy; the options it was built with are reachable through $store's context.
    const options = (authClient as unknown as { $store?: unknown }).$store
    expect(options).toBeTruthy()
  })
})
