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
