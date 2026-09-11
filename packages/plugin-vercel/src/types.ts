import type { Access, CollectionSlug, GlobalSlug, PayloadRequest, TypedUser } from 'payload'

import type { VercelDeployment } from './vercel/types.js'

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export type TargetOptions = {
  /** Use the build cache on Vercel. `false` appends `?buildCache=false` to every trigger. Default true. */
  buildCache?: boolean
  /**
   * Deploy hook URL from the Vercel project's Git settings, e.g.
   * `https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy`. Leave undefined (an unset env var) and the
   * target is registered as "not configured": shown greyed in the admin, never triggered.
   */
  hook?: string
  label?: string
  /** Vercel project id. Defaults to the id parsed from the hook URL. */
  projectId?: string
  slug: string
  /** Per-target overrides of the plugin-level token / team. */
  teamId?: string
  token?: string
  /** Public URL of the site, for the "Open site" link. */
  url?: string
}

export type TrackedCollectionOptions = {
  /**
   * `publish` (default for collections with drafts): only saves that leave the document published, plus
   * unpublish and delete. `change`: every save.
   */
  on?: 'change' | 'publish'
  /** Target slugs this collection deploys to. Default: every configured target. */
  targets?: string[]
}

export type TrackedGlobalOptions = {
  targets?: string[]
}

export type AutoDeployOptions = {
  /** Upper bound on how long a target waits while changes keep arriving. Default `'10m'`. */
  maxWait?: number | string
  /** Time without changes before an automatic deployment fires. Default `'60s'`. */
  quietPeriod?: number | string
}

export type TickOptions = {
  /** The admin header widget's status poll runs a tick server-side. Default true. */
  adminHeartbeat?: boolean
  /** `navigator.sendBeacon('/api/vercel/flush')` when an admin tab closes fires pending targets at once. Default true. */
  beacon?: boolean
  /** Register the `vercel:tick` scheduled task. Default true. */
  job?: boolean | { cron?: string; queue?: string }
  /** Shared secret accepted in the `x-vercel-plugin-secret` header by `POST /api/vercel/tick`. */
  secret?: string
}

export type RetentionOptions = {
  /** Delete deployment rows older than this many days. Default 90. */
  days?: number
  /** Keep at most this many rows per target. Default 200. */
  keep?: number
}

export type VercelPluginHooks = {
  onError?: (args: { record: DeploymentRecord }) => Promise<void> | void
  onReady?: (args: { record: DeploymentRecord }) => Promise<void> | void
  onStateChange?: (args: { previousState: DeploymentState; record: DeploymentRecord }) => Promise<void> | void
  onTriggered?: (args: { cause: DeploymentCause; record: DeploymentRecord; target: SanitizedTarget }) => Promise<void> | void
  /** Return false to skip recording a change. */
  shouldTrack?: (args: {
    collection?: string
    doc: Record<string, unknown>
    global?: string
    operation: ChangeOperation
    previousDoc?: Record<string, unknown>
    req: PayloadRequest
  }) => boolean | Promise<boolean>
}

export type VercelPluginOptions = {
  access?: {
    /** Trigger deployments, flush, pause. Default: any logged-in admin user. */
    deploy?: Access
    /** Read status, pending changes, history. Default: any logged-in admin user. */
    read?: Access
    /** Cancel and rollback. Default: any logged-in admin user. */
    rollback?: Access
  }
  admin?: {
    /** Where the `vercel-deployments` collection sits in the nav. Default `'Vercel'`. */
    group?: string
    /** Show the per-document "Not deployed yet" pill on tracked collections and globals. Default true. */
    documentPill?: boolean
    /** Header status widget on every admin page. Default true. */
    header?: boolean
    /** The Deployments view and its nav link. Default true; pass `{ path }` to move it. */
    view?: boolean | { path?: `/${string}` }
  }
  /** Base URL of the Vercel REST API. Only change it to point at a mock server. */
  apiBase?: string
  /** `false` disables automatic deployments entirely (manual + API only). */
  autoDeploy?: AutoDeployOptions | false
  collections?: Partial<Record<CollectionSlug, TrackedCollectionOptions | true>>
  disabled?: boolean
  globals?: Partial<Record<GlobalSlug, TrackedGlobalOptions | true>>
  hooks?: VercelPluginHooks
  /** Record deployments seen on Vercel that Payload did not trigger (git pushes, redeploys). Default true. */
  recordExternalDeployments?: boolean
  retention?: RetentionOptions
  slugs?: {
    changes?: string
    deployments?: string
    targets?: string
  }
  targets: TargetOptions[]
  /** Vercel team id, required when the token belongs to a team. */
  teamId?: string
  tick?: TickOptions
  /** Vercel access token. Optional: without it the plugin triggers and tracks changes but cannot read status. */
  token?: string
  /** Secret shown once when creating the account webhook on Vercel. Enables `POST /api/vercel/webhook`. */
  webhookSecret?: string
}

/* ------------------------------------------------------------------ */
/* Sanitized options                                                   */
/* ------------------------------------------------------------------ */

export type SanitizedTarget = {
  buildCache: boolean
  configured: boolean
  hook?: string
  /** Name of the env var / hint shown when the hook is missing. */
  label: string
  projectId?: string
  slug: string
  teamId?: string
  token?: string
  url?: string
}

export type SanitizedTrackedCollection = { on: 'change' | 'publish'; targets: string[] }
export type SanitizedTrackedGlobal = { targets: string[] }

export type SanitizedVercelPluginOptions = {
  access: { deploy: Access; read: Access; rollback: Access }
  admin: { documentPill: boolean; group: string; header: boolean; view: false | { path: `/${string}` } }
  apiBase: string
  autoDeploy: false | { maxWaitMs: number; quietPeriodMs: number }
  collections: Record<string, SanitizedTrackedCollection>
  disabled: boolean
  globals: Record<string, SanitizedTrackedGlobal>
  hooks: VercelPluginHooks
  recordExternalDeployments: boolean
  retention: { days: number; keep: number }
  slugs: { changes: string; deployments: string; targets: string }
  targets: SanitizedTarget[]
  teamId?: string
  tick: { adminHeartbeat: boolean; beacon: boolean; job: false | { cron: string; queue: string }; secret?: string }
  token?: string
  webhookSecret?: string
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

export type DeploymentCause = 'api' | 'auto' | 'external' | 'manual' | 'rollback'
export type DeploymentState = 'building' | 'canceled' | 'error' | 'queued' | 'ready' | 'triggered' | 'unknown'
export type ChangeOperation = 'create' | 'delete' | 'publish' | 'unpublish' | 'update'

export type ChangeSummaryItem = {
  /** Collection slug, or empty for a global. */
  c: string
  /** Global slug when the item is a global. */
  g?: string
  id?: string
  op: ChangeOperation
  t: string
}

export type ChangeSummary = {
  counts: Record<string, number>
  items: ChangeSummaryItem[]
}

/** A row of the `vercel-deployments` ledger. */
export type DeploymentRecord = {
  buildingAt?: null | string
  cause: DeploymentCause
  changeCount: number
  changes?: ChangeSummary | null
  createdAt: string
  dedupeKey: string
  deploymentId?: null | string
  deploymentUrl?: null | string
  durationMs?: null | number
  environment?: 'preview' | 'production' | null
  errorCode?: null | string
  errorMessage?: null | string
  hookCalledAt?: null | string
  hookJobId?: null | string
  id: number | string
  inspectorUrl?: null | string
  lastCheckedAt?: null | string
  readyAt?: null | string
  readySubstate?: null | string
  reason?: null | string
  rollbackOf?: null | string
  rollbackTo?: null | string
  state: DeploymentState
  supersededBy?: null | number | string | { id: number | string }
  target: string
  /** A user id at depth 0; the user document (id, email, name…) at depth 1, as the history endpoint returns it. */
  triggeredBy?: null | number | string | { email?: string; id: number | string; name?: string }
  updatedAt: string
  vercelCreatedAt?: null | string
}

/** A row of the `vercel-changes` pending set. */
export type PendingChange = {
  changedAt: string
  collection?: null | string
  docId?: null | string
  global?: null | string
  id: number | string
  operation: ChangeOperation
  saves: number
  target: string
  title: string
  user?: null | number | string | { id: number | string }
}

/** A row of the hidden `vercel-targets` collection: runtime state per target. */
export type TargetStateRecord = {
  currentDeploymentId?: null | string
  currentState?: DeploymentState | null
  currentUrl?: null | string
  dueAt?: null | string
  id: number | string
  lastError?: null | string
  lastExternalScanAt?: null | string
  lastResolvedAt?: null | string
  lastRetentionAt?: null | string
  lastTickAt?: null | string
  lastTickSource?: null | TickSource
  lastTriggerAt?: null | string
  paused: boolean
  pendingSince?: null | string
  slug: string
  /** ISO timestamps of hook calls in the last hour (bounded list). */
  triggerTimes?: null | string[]
}

export type TickSource = 'beacon' | 'endpoint' | 'heartbeat' | 'job' | 'local'

export type TargetStatus = {
  configured: boolean
  current?: DeploymentRecord | null
  dueAt: null | string
  inFlight?: DeploymentRecord | null
  label: string
  lastError: null | string
  lastTickAt: null | string
  lastTickSource: null | TickSource
  lastTriggerAt: null | string
  paused: boolean
  pendingCount: number
  pendingSince: null | string
  projectId?: string
  slug: string
  /** Whether a token is available for this target (status, cancel, rollback). */
  tokenConfigured: boolean
  triggersLastHour: number
  url?: string
  /** Hint shown when `configured` is false. */
  missing?: string
}

export type TickResult = {
  errors: string[]
  refreshed: number
  source: TickSource
  triggered: string[]
}

export type TriggerArgs = {
  buildCache?: boolean
  cause: DeploymentCause
  /** Unique per target; two triggers with the same key produce one row. */
  dedupeKey?: string
  reason?: string
  req?: PayloadRequest
  user?: null | TypedUser
}

export type VercelAPI = {
  cancel(deploymentId: string, opts?: { req?: PayloadRequest }): Promise<DeploymentRecord>
  deploy(args?: { buildCache?: boolean; reason?: string; req?: PayloadRequest; target?: string }): Promise<DeploymentRecord>
  deployAll(args?: { reason?: string; req?: PayloadRequest }): Promise<DeploymentRecord[]>
  /** Fire every target that has pending changes, ignoring the quiet period. */
  flush(opts?: { req?: PayloadRequest; targets?: string[] }): Promise<DeploymentRecord[]>
  history(target: string, opts?: { limit?: number }): Promise<DeploymentRecord[]>
  markChanged(args: {
    collection?: string
    global?: string
    id?: number | string
    operation?: ChangeOperation
    req?: PayloadRequest
    target?: string
    title?: string
  }): Promise<void>
  options: SanitizedVercelPluginOptions
  pause(target: string, paused: boolean): Promise<void>
  pending(target: string, opts?: { limit?: number }): Promise<PendingChange[]>
  refresh(target?: string): Promise<void>
  rollback(args: { req?: PayloadRequest; target: string; toDeploymentId: string }): Promise<DeploymentRecord>
  rollbackCandidates(target: string): Promise<VercelDeployment[]>
  status(): Promise<TargetStatus[]>
  status(target: string): Promise<TargetStatus>
  target(slug?: string): SanitizedTarget
  tick(source?: TickSource): Promise<TickResult>
}
