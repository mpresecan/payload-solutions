'use client'
import type { TargetStatus } from '../types.js'

/** `Pill`'s `pillStyle` union (the type itself is not exported from @payloadcms/ui). */
export type PillStyle = 'always-white' | 'dark' | 'error' | 'light' | 'light-gray' | 'success' | 'warning' | 'white'

import { countdown, relativeTime } from './api.js'

export type Presentation = {
  /** Primary action label for the header widget. */
  action: 'deploy' | 'deploy-now' | 'none' | 'resume'
  detail?: string
  pillStyle: PillStyle
  text: string
  tone: 'building' | 'error' | 'idle' | 'ok' | 'paused' | 'pending' | 'unconfigured' | 'waiting'
}

const RUNNER_STALE_MS = 15 * 60_000

/** One place that turns a target's status into what the widgets show. */
export function present(t: TargetStatus, now: number, autoDeploy: boolean): Presentation {
  if (!t.configured) {
    return { action: 'none', detail: t.missing, pillStyle: 'light-gray', text: 'Not configured', tone: 'unconfigured' }
  }
  if (t.inFlight) {
    const since = t.inFlight.vercelCreatedAt ?? t.inFlight.hookCalledAt ?? t.inFlight.createdAt
    const elapsed = countdownElapsed(since, now)
    const label = t.inFlight.state === 'building' ? 'Building' : t.inFlight.state === 'queued' ? 'Queued' : 'Deploy requested'
    return { action: 'none', detail: t.inFlight.deploymentUrl ?? undefined, pillStyle: 'light', text: `${label}… ${elapsed}`, tone: 'building' }
  }
  if (t.paused) {
    return { action: 'resume', pillStyle: 'warning', text: t.pendingCount ? `Paused · ${t.pendingCount} pending` : 'Paused', tone: 'paused' }
  }
  const failed = t.current?.state === 'error' || t.lastError
  if (t.pendingCount > 0 || t.dueAt) {
    const stale = t.lastTickAt ? now - new Date(t.lastTickAt).getTime() > RUNNER_STALE_MS : false
    if (failed && t.current?.state === 'error') {
      return { action: 'deploy', detail: t.current.errorMessage ?? undefined, pillStyle: 'error', text: `Failed · ${t.pendingCount} not deployed`, tone: 'error' }
    }
    if (autoDeploy && t.dueAt) {
      if (stale) {
        return { action: 'deploy-now', pillStyle: 'warning', text: `${t.pendingCount} pending · waiting for a runner`, tone: 'waiting' }
      }
      return { action: 'deploy-now', pillStyle: 'light', text: `${t.pendingCount} ${t.pendingCount === 1 ? 'change' : 'changes'} · deploying in ${countdown(t.dueAt, now)}`, tone: 'pending' }
    }
    return { action: 'deploy', pillStyle: 'light', text: `${t.pendingCount} ${t.pendingCount === 1 ? 'change' : 'changes'} to deploy`, tone: 'pending' }
  }
  if (t.current?.state === 'error') {
    return { action: 'deploy', detail: t.current.errorMessage ?? undefined, pillStyle: 'error', text: 'Last deploy failed', tone: 'error' }
  }
  if (t.lastError) {
    return { action: 'deploy', detail: t.lastError, pillStyle: 'warning', text: 'Vercel API error', tone: 'error' }
  }
  if (t.current?.state === 'ready' && now - new Date(t.current.readyAt ?? t.current.updatedAt).getTime() < 30_000) {
    return { action: 'deploy', detail: t.current.deploymentUrl ?? undefined, pillStyle: 'success', text: 'Deployed', tone: 'ok' }
  }
  return {
    action: 'deploy',
    detail: t.current ? `Deployed ${relativeTime(t.current.readyAt ?? t.current.createdAt, now)}` : undefined,
    pillStyle: 'light-gray',
    text: 'Up to date',
    tone: 'idle',
  }
}

function countdownElapsed(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function stateLabel(state: string): string {
  switch (state) {
    case 'building':
      return 'Building'
    case 'canceled':
      return 'Canceled'
    case 'error':
      return 'Failed'
    case 'queued':
      return 'Queued'
    case 'ready':
      return 'Ready'
    case 'triggered':
      return 'Triggered'
    default:
      return 'Unknown'
  }
}

export function statePillStyle(state: string): PillStyle {
  switch (state) {
    case 'building':
    case 'queued':
    case 'triggered':
      return 'light'
    case 'canceled':
      return 'light-gray'
    case 'error':
      return 'error'
    case 'ready':
      return 'success'
    default:
      return 'warning'
  }
}

export function causeLabel(cause: string): string {
  switch (cause) {
    case 'api':
      return 'API'
    case 'auto':
      return 'Automatic'
    case 'external':
      return 'Git / Vercel'
    case 'manual':
      return 'Manual'
    case 'rollback':
      return 'Rollback'
    default:
      return cause
  }
}
