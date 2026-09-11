import type { DeploymentRecord, DeploymentState } from '../types.js'
import type { VercelDeployment, VercelReadyState } from '../vercel/types.js'

import { deploymentId } from '../vercel/types.js'

export const TERMINAL_STATES: ReadonlySet<DeploymentState> = new Set(['canceled', 'error', 'ready', 'unknown'])
export const IN_FLIGHT_STATES: readonly DeploymentState[] = ['triggered', 'queued', 'building']

export function isInFlight(state: DeploymentState): boolean {
  return IN_FLIGHT_STATES.includes(state)
}

export function stateFromVercel(readyState: VercelReadyState | undefined): DeploymentState {
  switch (readyState) {
    case 'BLOCKED':
    case 'INITIALIZING':
    case 'QUEUED':
      return 'queued'
    case 'BUILDING':
      return 'building'
    case 'CANCELED':
      return 'canceled'
    case 'ERROR':
      return 'error'
    case 'READY':
      return 'ready'
    case 'DELETED':
    default:
      return 'unknown'
  }
}

/** Terminal states never regress; in-flight states only move forward (queued → building). */
export function canTransition(from: DeploymentState, to: DeploymentState): boolean {
  if (from === to) {
    return false
  }
  if (TERMINAL_STATES.has(from)) {
    return false
  }
  if (from === 'building' && to === 'queued') {
    return false
  }
  return true
}

/** Field patch derived from a Vercel deployment object. */
export function patchFromVercel(d: VercelDeployment): Partial<DeploymentRecord> {
  const created = d.created ?? d.createdAt
  const patch: Partial<DeploymentRecord> = {
    deploymentId: deploymentId(d) || undefined,
    deploymentUrl: d.url ? (d.url.startsWith('http') ? d.url : `https://${d.url}`) : undefined,
    environment: d.target === 'production' ? 'production' : 'preview',
    errorCode: d.errorCode ?? null,
    errorMessage: d.errorMessage ? d.errorMessage.slice(0, 500) : null,
    inspectorUrl: d.inspectorUrl ?? undefined,
    lastCheckedAt: new Date().toISOString(),
    readySubstate: d.readySubstate ?? null,
    state: stateFromVercel(d.readyState ?? d.state),
  }
  if (created) {
    patch.vercelCreatedAt = new Date(created).toISOString()
  }
  if (d.buildingAt) {
    patch.buildingAt = new Date(d.buildingAt).toISOString()
  }
  if (d.ready) {
    patch.readyAt = new Date(d.ready).toISOString()
    if (created) {
      patch.durationMs = Math.max(0, d.ready - created)
    }
  }
  return patch
}
