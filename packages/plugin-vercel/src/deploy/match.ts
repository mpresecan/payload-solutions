import type { VercelDeployment } from '../vercel/types.js'

import { deploymentId } from '../vercel/types.js'

/** Clock skew allowed between our hook call and Vercel's `created` timestamp. */
export const MATCH_SKEW_MS = 30_000
/** After this long without a candidate a triggered row becomes `unknown`. */
export const MATCH_GIVE_UP_MS = 10 * 60_000

export type MatchInput = {
  /** Deployment ids already claimed by other ledger rows. */
  claimed: ReadonlySet<string>
  /** Candidate deployments for the project, any order. */
  deployments: VercelDeployment[]
  /** When our hook call was made. */
  hookCalledAt: Date
}

/**
 * Pick the deployment created by our hook call: the earliest unclaimed `git-deploy-hook` deployment
 * created no earlier than `hookCalledAt - skew`. Vercel exposes no id linking a hook job to its deployment,
 * so this is the only correlation available (maintainer-recommended, vercel/vercel#3875).
 */
export function matchDeployment(input: MatchInput): null | VercelDeployment {
  const floor = input.hookCalledAt.getTime() - MATCH_SKEW_MS
  const candidates = input.deployments
    .filter((d) => d.source === 'git-deploy-hook')
    .filter((d) => (d.created ?? d.createdAt ?? 0) >= floor)
    .filter((d) => !input.claimed.has(deploymentId(d)))
    .sort((a, b) => (a.created ?? a.createdAt ?? 0) - (b.created ?? b.createdAt ?? 0))
  return candidates[0] ?? null
}

/** Deployments in the window that no ledger row claims — git pushes, redeploys, other hooks. */
export function unclaimedDeployments(deployments: VercelDeployment[], claimed: ReadonlySet<string>): VercelDeployment[] {
  return deployments.filter((d) => !claimed.has(deploymentId(d)))
}
