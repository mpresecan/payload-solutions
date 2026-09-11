import type { ChangeOperation, ChangeSummary, ChangeSummaryItem, PendingChange } from '../types.js'

/** How many items a deployment row keeps. Beyond it only the counts survive (§7.4 of the spec). */
export const SUMMARY_ITEM_CAP = 100
export const TITLE_MAX = 120

export function summarize(rows: PendingChange[]): ChangeSummary {
  const counts: Record<string, number> = {}
  const items: ChangeSummaryItem[] = []
  for (const row of rows) {
    const key = row.global ? `global:${row.global}` : (row.collection ?? '?')
    counts[key] = (counts[key] ?? 0) + 1
    if (items.length < SUMMARY_ITEM_CAP) {
      const item: ChangeSummaryItem = { c: row.collection ?? '', op: row.operation, t: row.title }
      if (row.global) {
        item.g = row.global
      }
      if (row.docId) {
        item.id = row.docId
      }
      items.push(item)
    }
  }
  return { counts, items }
}

/** Publish semantics for a collection save. `null` means "do not record". */
export function classifyChange(args: {
  doc: Record<string, unknown>
  hasDrafts: boolean
  on: 'change' | 'publish'
  operation: 'create' | 'update'
  previousDoc?: Record<string, unknown> | undefined
}): ChangeOperation | null {
  const { doc, hasDrafts, on, operation, previousDoc } = args
  if (!hasDrafts || on === 'change') {
    return operation === 'create' ? 'create' : 'update'
  }
  const status = doc._status
  const previousStatus = previousDoc?._status
  if (status === 'published') {
    return 'publish'
  }
  if (previousStatus === 'published' && status === 'draft') {
    return 'unpublish'
  }
  return null
}

export function resolveTitle(doc: Record<string, unknown>, useAsTitle: string | undefined, id: unknown): string {
  const raw = useAsTitle ? doc[useAsTitle] : undefined
  let title: string
  if (typeof raw === 'string' && raw.trim()) {
    title = raw.trim()
  } else if (typeof raw === 'number') {
    title = String(raw)
  } else if (raw && typeof raw === 'object') {
    // Localized field returning { en: '...' }: take the first non-empty value.
    const first = Object.values(raw as Record<string, unknown>).find((v) => typeof v === 'string' && v.trim())
    title = typeof first === 'string' ? first.trim() : `#${String(id ?? '')}`
  } else {
    title = `#${String(id ?? '')}`
  }
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title
}
