'use client'
import type { DeploymentRecord, PendingChange, TargetStatus } from '../types.js'
import type { VercelDeployment } from '../vercel/types.js'

/** Shape of `GET /api/vercel/status`. */
export type StatusResponse = {
  autoDeploy: false | { maxWaitMs: number; quietPeriodMs: number }
  beacon: boolean
  now: string
  permissions: { deploy: boolean; rollback: boolean }
  targets: TargetStatus[]
  viewPath: null | string
}

export type DocumentState = 'deploying' | 'failed' | 'live' | 'pending'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(apiRoute: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiRoute}/vercel${path}`, {
    credentials: 'include',
    ...init,
    headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
  })
  const text = await res.text()
  let body: any = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = {}
  }
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? body?.errors?.[0]?.message ?? `Request failed (${res.status})`)
  }
  return body as T
}

/* One in-flight status request is shared by every widget on the page. */
let inflight: null | Promise<StatusResponse> = null
let cached: null | { at: number; data: StatusResponse } = null
const listeners = new Set<(data: StatusResponse) => void>()

export function subscribeStatus(listener: (data: StatusResponse) => void): () => void {
  listeners.add(listener)
  if (cached) {
    listener(cached.data)
  }
  return () => {
    listeners.delete(listener)
  }
}

export function fetchStatus(apiRoute: string, opts: { maxAgeMs?: number; tick?: boolean } = {}): Promise<StatusResponse> {
  const maxAge = opts.maxAgeMs ?? 2000
  if (cached && Date.now() - cached.at < maxAge) {
    return Promise.resolve(cached.data)
  }
  if (inflight) {
    return inflight
  }
  inflight = request<StatusResponse>(apiRoute, `/status${opts.tick === false ? '?tick=0' : ''}`)
    .then((data) => {
      cached = { at: Date.now(), data }
      for (const listener of listeners) {
        listener(data)
      }
      return data
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function invalidateStatus(): void {
  cached = null
}

export const vercelApi = {
  cancel: (apiRoute: string, deploymentId: string) =>
    request<{ deployment: DeploymentRecord }>(apiRoute, '/cancel', { body: JSON.stringify({ deploymentId }), method: 'POST' }),
  changes: (apiRoute: string, target: string, limit = 100) =>
    request<{ changes: PendingChange[]; total: number }>(apiRoute, `/changes?target=${encodeURIComponent(target)}&limit=${limit}`),
  deploy: (apiRoute: string, args: { buildCache?: boolean; reason?: string; target: string }) =>
    request<{ deployment: DeploymentRecord }>(apiRoute, '/deploy', { body: JSON.stringify(args), method: 'POST' }),
  document: (apiRoute: string, args: { collection?: string; global?: string; id?: number | string }) => {
    const q = new URLSearchParams()
    if (args.collection) {
      q.set('collection', args.collection)
    }
    if (args.global) {
      q.set('global', args.global)
    }
    if (args.id !== undefined && args.id !== null) {
      q.set('id', String(args.id))
    }
    return request<{ targets: Record<string, DocumentState>; tracked: boolean }>(apiRoute, `/document?${q.toString()}`)
  },
  history: (apiRoute: string, target: string, limit = 20) =>
    request<{ deployments: DeploymentRecord[] }>(apiRoute, `/history?target=${encodeURIComponent(target)}&limit=${limit}`),
  pause: (apiRoute: string, target: string, paused: boolean) =>
    request<{ paused: boolean }>(apiRoute, '/pause', { body: JSON.stringify({ paused, target }), method: 'PATCH' }),
  rollback: (apiRoute: string, target: string, toDeploymentId: string) =>
    request<{ deployment: DeploymentRecord }>(apiRoute, '/rollback', { body: JSON.stringify({ target, toDeploymentId }), method: 'POST' }),
  rollbackCandidates: (apiRoute: string, target: string) =>
    request<{ candidates: VercelDeployment[] }>(apiRoute, `/rollback-candidates?target=${encodeURIComponent(target)}`),
}

/** Fire pending targets when the tab goes away; cookies ride along with the beacon. */
export function sendFlushBeacon(apiRoute: string): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(`${apiRoute}/vercel/flush`, new Blob(['{}'], { type: 'application/json' }))
    }
  } catch {
    // best effort
  }
}

export function relativeTime(iso: null | string | undefined, now = Date.now()): string {
  if (!iso) {
    return '—'
  }
  const diff = Math.max(0, now - new Date(iso).getTime())
  const s = Math.round(diff / 1000)
  if (s < 5) {
    return 'just now'
  }
  if (s < 60) {
    return `${s} s ago`
  }
  const m = Math.round(s / 60)
  if (m < 60) {
    return `${m} min ago`
  }
  const h = Math.round(m / 60)
  if (h < 48) {
    return `${h} h ago`
  }
  return `${Math.round(h / 24)} d ago`
}

export function countdown(iso: null | string | undefined, now = Date.now()): string {
  if (!iso) {
    return ''
  }
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) {
    return 'now'
  }
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`
}
