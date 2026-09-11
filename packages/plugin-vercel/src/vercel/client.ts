import type { SanitizedTarget } from '../types.js'
import type { VercelDeployment, VercelDeploymentList, VercelHookResponse } from './types.js'

export class VercelApiError extends Error {
  body: string
  status: number
  constructor(status: number, body: string, message?: string) {
    super(message ?? `Vercel API responded ${status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    this.name = 'VercelApiError'
    this.status = status
    this.body = body
  }
}

export type VercelClientOptions = {
  apiBase: string
  fetch?: typeof fetch
  teamId?: string
  timeoutMs?: number
  token?: string
}

const DEFAULT_TIMEOUT = 10_000

function withTeam(url: URL, teamId?: string): URL {
  if (teamId) {
    url.searchParams.set('teamId', teamId)
  }
  return url
}

/** Thin wrapper over the handful of Vercel endpoints the plugin needs. */
export class VercelClient {
  private readonly apiBase: string
  private readonly fetchImpl: typeof fetch
  private readonly teamId?: string
  private readonly timeoutMs: number
  private readonly token?: string

  constructor(opts: VercelClientOptions) {
    this.apiBase = opts.apiBase.replace(/\/+$/, '')
    this.fetchImpl = opts.fetch ?? fetch
    this.teamId = opts.teamId
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT
    this.token = opts.token
  }

  static forTarget(target: SanitizedTarget, apiBase: string, fetchImpl?: typeof fetch): VercelClient {
    return new VercelClient({ apiBase, fetch: fetchImpl, teamId: target.teamId, token: target.token })
  }

  get hasToken(): boolean {
    return Boolean(this.token)
  }

  /** `PATCH /v12/deployments/{id}/cancel` */
  async cancelDeployment(id: string): Promise<VercelDeployment> {
    return (await this.request('PATCH', `/v12/deployments/${encodeURIComponent(id)}/cancel`)) as VercelDeployment
  }

  /** `GET /v13/deployments/{idOrUrl}` */
  async getDeployment(idOrUrl: string): Promise<VercelDeployment> {
    return (await this.request('GET', `/v13/deployments/${encodeURIComponent(idOrUrl)}`)) as VercelDeployment
  }

  /** `GET /v7/deployments` */
  async listDeployments(params: {
    limit?: number
    projectId: string
    since?: number
    state?: string
    target?: string
    until?: number
  }): Promise<VercelDeployment[]> {
    const query: Record<string, string> = { projectId: params.projectId }
    if (params.limit) {
      query.limit = String(params.limit)
    }
    if (params.since) {
      query.since = String(params.since)
    }
    if (params.until) {
      query.until = String(params.until)
    }
    if (params.state) {
      query.state = params.state
    }
    if (params.target) {
      query.target = params.target
    }
    const body = (await this.request('GET', '/v7/deployments', undefined, query)) as VercelDeploymentList
    return body.deployments ?? []
  }

  /** `POST /v1/projects/{projectId}/rollback/{deploymentId}` — instant, no build. */
  async rollback(projectId: string, deploymentId: string): Promise<unknown> {
    return this.request(
      'POST',
      `/v1/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(deploymentId)}`,
    )
  }

  /**
   * Trigger a deploy hook. No auth, no body; the URL is the credential. One retry on network errors and
   * 5xx, none on 4xx. Returns the hook job (whose id is not a deployment id).
   */
  async triggerHook(hookUrl: string, opts: { buildCache?: boolean } = {}): Promise<VercelHookResponse> {
    const url = new URL(hookUrl)
    if (opts.buildCache === false) {
      url.searchParams.set('buildCache', 'false')
    }
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          headers: { accept: 'application/json' },
          method: 'POST',
          signal: AbortSignal.timeout(this.timeoutMs),
        })
        const text = await res.text()
        if (res.ok) {
          try {
            return JSON.parse(text) as VercelHookResponse
          } catch {
            return { job: { createdAt: Date.now(), id: '', state: 'PENDING' } }
          }
        }
        lastError = new VercelApiError(res.status, text, `Deploy hook responded ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
        if (res.status < 500) {
          break
        }
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private async request(
    method: 'GET' | 'PATCH' | 'POST',
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<unknown> {
    if (!this.token) {
      throw new VercelApiError(401, '', 'No Vercel token configured')
    }
    const url = withTeam(new URL(this.apiBase + path), this.teamId)
    for (const [k, v] of Object.entries(query ?? {})) {
      url.searchParams.set(k, v)
    }
    const res = await this.fetchImpl(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      method,
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new VercelApiError(res.status, text)
    }
    if (!text) {
      return {}
    }
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }
}
