/** The subset of Vercel's REST API shapes this plugin reads. Field names follow the API exactly. */

export type VercelReadyState =
  | 'BLOCKED'
  | 'BUILDING'
  | 'CANCELED'
  | 'DELETED'
  | 'ERROR'
  | 'INITIALIZING'
  | 'QUEUED'
  | 'READY'

export type VercelDeploymentSource =
  | 'api-trigger-git-deploy'
  | 'cli'
  | 'clone/repo'
  | 'drop'
  | 'git'
  | 'git-deploy-hook'
  | 'import'
  | 'import/repo'
  | 'redeploy'
  | 'v0-web'

/** Item of `GET /v7/deployments` and the relevant part of `GET /v13/deployments/{id}`. */
export type VercelDeployment = {
  buildingAt?: number
  created?: number
  createdAt?: number
  creator?: { email?: string; uid: string; username?: string }
  errorCode?: string
  errorMessage?: null | string
  inspectorUrl?: null | string
  isRollbackCandidate?: boolean | null
  meta?: Record<string, string>
  name: string
  projectId?: string
  ready?: number
  readyState: VercelReadyState
  readySubstate?: 'PROMOTED' | 'ROLLING' | 'STAGED'
  source?: VercelDeploymentSource
  state?: VercelReadyState
  target?: 'production' | 'staging' | null
  /** `uid` in list responses, `id` in get responses. */
  uid?: string
  id?: string
  url: null | string
}

export type VercelDeploymentList = {
  deployments: VercelDeployment[]
  pagination: { count: number; next: null | number; prev: null | number }
}

/** Response of a deploy hook call. */
export type VercelHookResponse = {
  job: { createdAt: number; id: string; state: string }
}

export type VercelWebhookDeploymentEvent = {
  createdAt: number
  id: string
  payload: {
    deployment: { id: string; meta?: Record<string, string>; name?: string; url?: string }
    links?: { deployment?: string; project?: string }
    project: { id: string }
    target?: 'production' | 'staging' | null
    team?: { id: string } | null
    user?: { id: string } | null
  }
  region?: string
  type:
    | 'deployment.canceled'
    | 'deployment.created'
    | 'deployment.error'
    | 'deployment.promoted'
    | 'deployment.ready'
    | 'deployment.succeeded'
    | (string & {})
}

export type VercelRollbackEvent = {
  createdAt: number
  id: string
  payload: { fromDeploymentId?: string; project?: { id: string }; toDeploymentId?: string }
  type: 'deployment.rollback'
}

export function deploymentId(d: VercelDeployment): string {
  return d.uid ?? d.id ?? ''
}
