'use client'

import type { ActionStatus, ScheduledAction } from '../types.js'

import { describeCron } from '../utils/cron-describe.js'
import { describeInterval, formatDuration } from '../utils/duration.js'

export const OPEN_EVENT = 'payload-action-scheduler:open'
export const REFRESH_EVENT = 'payload-action-scheduler:refresh'
export const DRAWER_SLUG = 'payload-action-scheduler-drawer'

export function openActionDrawer(id: number | string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } }))
}

export function requestRefresh(): void {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT))
}

export type Row = Partial<ScheduledAction> & { id: number | string }

export const TERMINAL: ActionStatus[] = ['complete', 'failed', 'canceled']
export const isRecurring = (row: Pick<Row, 'repeat'>) => row.repeat === 'interval' || row.repeat === 'cron'
export const isPastDue = (row: Pick<Row, 'scheduleAt' | 'status'>, now = Date.now()) =>
  row.status === 'pending' && !!row.scheduleAt && new Date(row.scheduleAt).getTime() < now - 60_000

export function spanText(ms: number): string {
  ms = Math.abs(ms)
  if (ms < 60_000) {
    return `${Math.max(1, Math.round(ms / 1000))} s`
  }
  if (ms < 3_600_000) {
    return `${Math.round(ms / 60_000)} min`
  }
  if (ms < 172_800_000) {
    return `${Math.round(ms / 3_600_000)} h`
  }
  return `${Math.round(ms / 86_400_000)} d`
}

export function relative(value: Date | null | string | undefined, now = Date.now()): string {
  if (!value) {
    return ''
  }
  const t = new Date(value).getTime()
  return t >= now ? `in ${spanText(t - now)}` : `${spanText(now - t)} ago`
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short', weekday: 'short' })
const fullFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  second: '2-digit',
  timeZoneName: 'short',
  weekday: 'short',
  year: 'numeric',
})

export function localTime(value: Date | null | string | undefined): string {
  if (!value) {
    return ''
  }
  const d = new Date(value)
  return d.toDateString() === new Date().toDateString() ? timeFmt.format(d) : dayFmt.format(d)
}

export function fullTime(value: Date | null | string | undefined): string {
  if (!value) {
    return ''
  }
  const d = new Date(value)
  return `${fullFmt.format(d)} · ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export function scheduleWords(row: Pick<Row, 'cron' | 'interval' | 'repeat' | 'tz'>): { raw?: string; tz?: string; words: string } {
  if (row.repeat === 'cron' && row.cron) {
    return { raw: row.cron, tz: row.tz && row.tz !== viewerTimeZone() ? row.tz : undefined, words: describeCron(row.cron) }
  }
  if (row.repeat === 'interval' && row.interval) {
    return { words: describeInterval(Number(row.interval)) }
  }
  return { words: 'Once' }
}

export function statusLabel(status: ActionStatus | undefined): string {
  switch (status) {
    case 'canceled':
      return 'Canceled'
    case 'complete':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'running':
      return 'Running'
    default:
      return 'Pending'
  }
}

export function failureWords(reason: null | string | undefined): string {
  switch (reason) {
    case 'args-invalid':
      return 'invalid arguments'
    case 'handler-missing':
      return 'not registered in code'
    case 'lost':
      return 'worker lost'
    case 'permanent':
      return 'permanent error'
    case 'timeout':
      return 'timed out'
    default:
      return 'error'
  }
}

export function lastResult(row: Row): { error?: boolean; text: string } | null {
  if (row.status === 'running') {
    return { text: `Attempt ${row.attempts ?? 1}/${row.maxAttempts ?? '?'} running` }
  }
  const dur = row.lastDurationMs != null ? formatDuration(row.lastDurationMs) : null
  switch (row.lastOutcome) {
    case 'completed':
      return { text: dur ? `Completed · ${dur}` : 'Completed' }
    case 'failed': {
      const short = shortError(row.errorMessage)
      const retry = row.status === 'pending' && row.scheduleAt ? ` · retry ${localTime(row.scheduleAt)}` : ''
      return { error: true, text: `Failed${short ? ` · ${short}` : ''}${retry}` }
    }
    case 'lost':
      return { error: true, text: `Worker lost${row.status === 'pending' && row.scheduleAt ? ` · retry ${localTime(row.scheduleAt)}` : ''}` }
    case 'skipped':
      return { text: `Skipped${row.note ? ` · ${row.note}` : ''}` }
    case 'timeout':
      return { error: true, text: `Timed out${dur ? ` after ${dur}` : ''}${row.status === 'pending' && row.scheduleAt ? ` · retry ${localTime(row.scheduleAt)}` : ''}` }
    default:
      return row.status === 'canceled' ? { text: 'Canceled' } : null
  }
}

export function shortError(message: null | string | undefined): string {
  if (!message) {
    return ''
  }
  const code = /\b(E[A-Z]{3,}|\d{3} [A-Z][a-z]+)\b/.exec(message)
  const s = (code ? code[0] : message.split(/[;:(]/)[0]!).trim()
  return s.length > 48 ? `${s.slice(0, 47)}…` : s
}

/** Which row actions apply in a given state (spec §12.6). */
export function availableActions(row: Row): { key: string; label: string; primary?: boolean; danger?: boolean }[] {
  const out: { danger?: boolean; key: string; label: string; primary?: boolean }[] = []
  const series = row.source === 'series'
  if (row.status === 'pending') {
    out.push({ key: 'run-now', label: 'Run now', primary: true }, { key: 'reschedule', label: 'Reschedule…' })
    out.push({ key: 'cancel', label: series ? 'Pause series' : 'Cancel', danger: true })
  }
  if (row.status === 'running' && isRecurring(row)) {
    out.push({ key: 'stop-after-current', label: 'Stop after this run', danger: true })
  }
  if (row.status === 'failed') {
    out.push({ key: 'retry', label: 'Retry now', primary: true })
  }
  out.push({ key: 'duplicate', label: 'Duplicate' })
  if (row.status && TERMINAL.includes(row.status)) {
    out.push({ key: 'delete', label: 'Delete', danger: true })
  }
  return out
}
