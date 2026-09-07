import type { ConsentExpr } from './types.js'

/** Evaluates a consent expression against a lookup of granted category keys. Unknown keys are `false`. */
export function evaluateExpr(expr: ConsentExpr, granted: (key: string) => boolean): boolean {
  if (typeof expr === 'string') return granted(expr)
  if ('and' in expr) return expr.and.every((e) => evaluateExpr(e, granted))
  if ('or' in expr) return expr.or.some((e) => evaluateExpr(e, granted))
  if ('not' in expr) return !evaluateExpr(expr.not, granted)
  return false
}
