/**
 * Load a module as if `src/stack.config.ts` contained a different configuration.
 *
 * Most of the template reads `stack.features.*` at import time (navigation, Better Auth options,
 * route tables, providers). To test those modules under every option, the stack config module is
 * replaced with `vi.doMock` and the module graph is reset before the module under test is
 * imported again. Use the returned value; never a top-level import of the same module.
 *
 *   const { mainNav } = await loadWithStack(presets['orgs-off'], () => import('@/components/dashboard/nav-config'))
 */
import { vi } from 'vitest'

import { defineStack, type StackConfig, type StackInput } from '@/lib/stack'

export function toStack(input: StackInput | StackConfig): StackConfig {
  return 'features' in input ? input : defineStack(input)
}

export async function loadWithStack<T>(input: StackInput | StackConfig, importer: () => Promise<T>): Promise<T> {
  const stack = toStack(input)
  vi.resetModules()
  vi.doMock('@/stack.config', () => ({ default: stack }))
  try {
    return await importer()
  } finally {
    vi.doUnmock('@/stack.config')
  }
}

/** Stub environment variables, reset modules, import. Combine with loadWithStack via `env` option. */
export async function loadWithEnv<T>(env: Record<string, string | undefined>, importer: () => Promise<T>): Promise<T> {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, '')
    else vi.stubEnv(key, value)
  }
  // vi.stubEnv('X', '') leaves an empty string, which zod's optional().min(1) rejects. Delete instead.
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
  }
  vi.resetModules()
  return importer()
}
