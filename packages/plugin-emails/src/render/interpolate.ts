import type { VariableManifest, VariableType } from '../types.js'

/** `{{ user.name }}` — also matches percent-encoded braces left by URL encoding in link hrefs. */
export const TOKEN_PATTERN = /(\\?)(?:\{\{|%7B%7B)\s*([a-zA-Z_][\w-]*(?:\.[a-zA-Z_][\w-]*)*)\s*(?:\}\}|%7D%7D)/gi

export type InterpolateOptions = {
  dateFormat?: Intl.DateTimeFormatOptions
  /** May arrive as null from `req.locale`; normalized before it reaches Intl. */
  locale?: null | string
  manifest?: VariableManifest
  /** `html` escapes by context; `text` inserts as-is. */
  mode: 'html' | 'text'
  /** Called for every token that has no value; return a replacement or undefined for ''. */
  onMissing?: (name: string) => string | undefined
}

const HTML_ESCAPES: Record<string, string> = {
  '"': '&quot;',
  '&': '&amp;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
}

const URL_PATTERN = /^(https?:\/\/|mailto:|tel:)/i

/**
 * Intl throws on anything that is not a valid locale string — and `null` in particular throws a
 * TypeError, not a RangeError. Payload hands us `req.locale === null` when a project has no
 * localization, so normalize before Intl ever sees it.
 */
function intlLocale(locale: null | string | undefined): string | undefined {
  return typeof locale === 'string' && locale.trim() ? locale : undefined
}

export function formatValue(
  value: unknown,
  type: VariableType | undefined,
  { dateFormat, locale }: Pick<InterpolateOptions, 'dateFormat' | 'locale'>,
): string {
  if (value === null || value === undefined) {
    return ''
  }
  switch (type) {
    case 'date': {
      const date = value instanceof Date ? value : new Date(value as number | string)
      if (Number.isNaN(date.getTime())) {
        return String(value)
      }
      try {
        return new Intl.DateTimeFormat(intlLocale(locale), dateFormat ?? { dateStyle: 'long' }).format(date)
      } catch {
        return date.toISOString()
      }
    }
    case 'number': {
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(num)) {
        return String(value)
      }
      try {
        return new Intl.NumberFormat(intlLocale(locale)).format(num)
      } catch {
        return String(num)
      }
    }
    case 'url': {
      const str = String(value).trim()
      return URL_PATTERN.test(str) ? str : ''
    }
    default:
      return typeof value === 'string' ? value : String(value)
  }
}

/** Nested objects → dotted paths. Dates and arrays are kept as values. */
export function flattenVariables(
  input: Record<string, unknown>,
  prefix = '',
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      flattenVariables(value as Record<string, unknown>, path, out)
    } else {
      out[path] = value
    }
  }
  return out
}

/**
 * Replace `{{tokens}}` in a template. Values are formatted by their manifest type, then escaped by
 * context. `html`-typed variables are inserted raw in HTML mode. `\{{` renders a literal `{{`.
 */
export function interpolate(
  template: string,
  variables: Record<string, unknown>,
  options: InterpolateOptions,
): string {
  if (!template) {
    return ''
  }
  return template.replace(TOKEN_PATTERN, (match, escaped: string, name: string) => {
    if (escaped) {
      return match.slice(1)
    }
    const type = options.manifest?.[name]?.type
    const hasValue = Object.prototype.hasOwnProperty.call(variables, name)
    if (!hasValue) {
      return options.onMissing?.(name) ?? ''
    }
    const formatted = formatValue(variables[name], type, options)
    if (options.mode === 'html') {
      return type === 'html' ? formatted : escapeHtml(formatted)
    }
    return type === 'html' ? htmlToText(formatted) : formatted
  })
}

/** Minimal HTML → text for `html`-typed variables in plain-text output. */
export function htmlToText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, (_, href: string, label: string) =>
      label.trim() && label.trim() !== href ? `${label.trim()} (${href})` : href,
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** All token names used in a template. */
export function extractTokens(template: string): string[] {
  const tokens = new Set<string>()
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    if (!match[1]) {
      tokens.add(match[2]!)
    }
  }
  return [...tokens]
}

export type TokenProblem = { name?: string; type: 'unbalanced' | 'unknown' }

/** Unknown or malformed tokens in a template, given the allowed variable names. */
export function findTokenProblems(template: string, allowed: Set<string>): TokenProblem[] {
  const problems: TokenProblem[] = []
  for (const name of extractTokens(template)) {
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
  const unknown = problems.filter((p) => p.type === 'unknown').map((p) => `{{${p.name}}}`)
  const parts: string[] = []
  if (unknown.length) {
    parts.push(`Unknown variable${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}.`)
  }
  if (problems.some((p) => p.type === 'unbalanced')) {
    parts.push('Unbalanced {{ }} — check that every variable opens and closes on the same text run.')
  }
  parts.push(`Available: ${[...allowed].map((v) => `{{${v}}}`).join(', ')}`)
  return parts.join(' ')
}
