import type { CollectionBeforeOperationHook, CollectionConfig, Where } from 'payload'

/**
 * Workarounds for known payload-auth 3.0.0 issues. Each entry names the upstream problem so it can
 * be deleted once a fix ships. See also `adminInvitations.collectionOverrides` in payload.config.ts.
 */

/**
 * Adapter messages that are logged with `console.error` but describe no actual problem.
 *
 * The Better Auth admin plugin adds `sessions.impersonatedBy`, so two fields on `sessions` point at
 * `users`. The adapter resolves `join: { user: true }` correctly (it picks `user`) but reports the
 * ambiguity on every session lookup, which floods the dev console and Next's error overlay.
 */
const SILENCED_ADAPTER_MESSAGES = [/^forward join field selection ambiguous for 'user' on \w+:/]

const FLAG = Symbol.for('payload-stack.payload-auth-warnings-silenced')

/**
 * Drops the known-harmless `[payload-db-adapter]` errors above and forwards everything else to the
 * original `console.error`. Safe to call more than once.
 */
export function silenceKnownPayloadAuthWarnings() {
  const scope = globalThis as unknown as Record<symbol, boolean>
  if (scope[FLAG]) return
  scope[FLAG] = true

  const original = console.error
  console.error = (...args: unknown[]) => {
    const [tag, message] = args
    if (
      tag === '[payload-db-adapter]' &&
      typeof message === 'string' &&
      SILENCED_ADAPTER_MESSAGES.some((pattern) => pattern.test(message))
    ) {
      return
    }
    original.apply(console, args)
  }
}

/**
 * payload-auth 3.0.0 marks the api-key plugin's `referenceId` as a relationship to users, so its
 * adapter turns the owner id into a number before querying (`referenceId = 2`). The column it
 * builds is a text field holding "2", so on SQLite and Postgres nothing matches: Settings → API keys
 * always says "No API keys" and keys cannot be revoked. Turn numeric `referenceId` values in where
 * clauses back into strings. MongoDB (text ids) is unaffected. Remove once fixed upstream.
 */
export function withStringApiKeyReferences({ collection }: { collection: CollectionConfig }): CollectionConfig {
  const stringify = (value: unknown): unknown =>
    typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(stringify) : value
  const fix = (where: unknown): unknown => {
    if (Array.isArray(where)) return where.map(fix)
    // Only walk plain objects: a Date (the api-key plugin's rate-limit window) must pass through.
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) return where
    return Object.fromEntries(
      Object.entries(where).map(([key, value]) =>
        key === 'referenceId' && value && typeof value === 'object'
          ? [key, Object.fromEntries(Object.entries(value).map(([op, v]) => [op, stringify(v)]))]
          : [key, fix(value)],
      ),
    )
  }
  const beforeOperation: CollectionBeforeOperationHook = ({ args }) =>
    args && 'where' in args && args.where ? { ...args, where: fix(args.where) as Where } : args
  return {
    ...collection,
    hooks: { ...collection.hooks, beforeOperation: [...(collection.hooks?.beforeOperation ?? []), beforeOperation] },
  }
}
