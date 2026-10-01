/**
 * `{{ firstName }}` or `{{ firstName | there }}` — the part after the bar is used when the value is
 * empty. Also matches percent-encoded braces and bar, which link URLs can pick up on the way through
 * the editor. The fallback is trimmed afterwards, which keeps the pattern linear.
 */
export const TOKEN_PATTERN =
  /(\\?)(?:\{\{|%7B%7B)\s*([a-z_][\w-]*(?:\.[a-z_][\w-]*)*)\s*(?:(?:\||%7C)([^{}|%]*))?(?:\}\}|%7D%7D)/gi

/** Returns the replacement for a token, or undefined to drop it. */
export type TokenResolver = (name: string, fallback: string | undefined) => string | undefined

/** Replace every token in a string. `\{{` renders a literal `{{`. */
export function interpolate(template: string, resolve: TokenResolver): string {
  if (!template) {
    return ''
  }
  return template.replace(
    TOKEN_PATTERN,
    (match, escaped: string, name: string, fallback?: string) => {
      if (escaped) {
        return match.slice(1)
      }
      return resolve(name, cleanFallback(fallback)) ?? ''
    },
  )
}

export function cleanFallback(fallback: string | undefined): string | undefined {
  if (fallback === undefined) {
    return undefined
  }
  const value = safeDecode(fallback).trim()
  return value || undefined
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Every token name used in a string, with the fallback it was written with (last one wins). */
export function extractTokens(template: string): Map<string, string | undefined> {
  const tokens = new Map<string, string | undefined>()
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    if (!match[1]) {
      tokens.set(match[2], cleanFallback(match[3]))
    }
  }
  return tokens
}

export type TokenProblem = { name?: string; type: 'unbalanced' | 'unknown' }

/** Unknown or malformed tokens in a string, given the allowed names. */
export function findTokenProblems(template: string, allowed: Set<string>): TokenProblem[] {
  const problems: TokenProblem[] = []
  for (const name of extractTokens(template).keys()) {
    if (!allowed.has(name)) {
      problems.push({ name, type: 'unknown' })
    }
  }
  const stripped = template.replace(TOKEN_PATTERN, '').replace(/\\\{\{/g, '')
  if (/\{\{|\}\}/.test(stripped)) {
    problems.push({ type: 'unbalanced' })
  }
  return problems
}

export function formatTokenProblems(problems: TokenProblem[], allowed: Iterable<string>): string {
  const unknown = [
    ...new Set(problems.filter((p) => p.type === 'unknown').map((p) => `{{${p.name}}}`)),
  ]
  const parts: string[] = []
  if (unknown.length) {
    parts.push(`Unknown variable${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}.`)
  }
  if (problems.some((p) => p.type === 'unbalanced')) {
    parts.push(
      'Unbalanced {{ }} — check that every variable opens and closes on the same text run.',
    )
  }
  parts.push(`Available: ${[...allowed].map((v) => `{{${v}}}`).join(', ')}`)
  return parts.join(' ')
}

/** Characters that would end or split a Resend placeholder. */
export const toPlaceholderFallback = (fallback: string): string =>
  fallback.replace(/[{}|]/g, '').trim()
