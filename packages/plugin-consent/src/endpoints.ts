import { headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { getConsentConfig } from './config.js'
import { allowRequest, clientIp } from './rate-limit.js'
import type { AnyDoc, ResolvedConsentPluginOptions } from './types.js'

const recordSchema = z.object({
  consentId: z.string().uuid(),
  decisions: z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), z.boolean()).refine((d) => Object.keys(d).length <= 50),
  versions: z.object({
    policyVersion: z.string().max(16),
    categoriesVersion: z.string().max(16),
    trackersVersion: z.string().max(16),
    documentsVersion: z.string().max(16),
  }),
  source: z.enum(['banner', 'preferences', 'api', 'gpc', 'withdraw', 'implicit']),
  locale: z.string().max(16).optional(),
})

const MONTH_MS = 30.4375 * 86_400_000

function json(req: PayloadRequest, body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const headers = headersWithCors({ headers: new Headers({ 'content-type': 'application/json', ...init.headers }), req })
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers })
}

function corsAllowed(req: PayloadRequest, options: ResolvedConsentPluginOptions): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  if (options.allowedOrigins.includes(origin)) return true
  try {
    const self = new URL(req.url ?? '', 'http://localhost').origin
    return origin === self
  } catch {
    return false
  }
}

function userAgentFamily(ua: string | null): string | undefined {
  if (!ua) return undefined
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua)) return 'Opera'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari'
  if (/Firefox\//.test(ua)) return 'Firefox'
  return 'Other'
}

export function createEndpoints(options: ResolvedConsentPluginOptions): Endpoint[] {
  const base = options.basePath.replace(/\/$/, '')

  const configEndpoint: Endpoint = {
    path: `${base}/config`,
    method: 'get',
    handler: async (req) => {
      if (!corsAllowed(req, options)) return json(req, { error: 'origin not allowed' }, { status: 403 })
      const url = new URL(req.url ?? '', 'http://localhost')
      const devOverride = process.env.NODE_ENV !== 'production' ? url.searchParams.get('consent_jurisdiction') : null
      const config = await getConsentConfig(req.payload, options, {
        locale: req.locale ?? undefined,
        headers: req.headers,
        country: devOverride ?? undefined,
        req,
      })
      const { recordingMode: _recordingMode, ...publicConfig } = config
      return json(req, publicConfig, {
        headers: {
          'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
          etag: `"${config.versions.policyVersion}:${config.locale}:${config.jurisdiction.model}"`,
          vary: 'Accept-Language, Origin, cf-ipcountry, x-vercel-ip-country',
        },
      })
    },
  }

  const recordsEndpoint: Endpoint = {
    path: `${base}/records`,
    method: 'post',
    handler: async (req) => {
      if (!corsAllowed(req, options)) return json(req, { error: 'origin not allowed' }, { status: 403 })
      const ip = clientIp(req.headers, options.jurisdiction.trustProxy)
      if (!allowRequest(`records:${ip}`, options.recording.rateLimitPerMinute)) {
        return json(req, { error: 'rate limited' }, { status: 429, headers: { 'retry-after': '60' } })
      }
      const raw = await readBody(req)
      if (raw === null) return json(req, { error: 'invalid body' }, { status: 400 })
      const parsed = recordSchema.safeParse(raw)
      if (!parsed.success) return json(req, { error: 'invalid body', issues: parsed.error.issues.slice(0, 5) }, { status: 400 })
      const body = parsed.data

      const config = await getConsentConfig(req.payload, options, { locale: body.locale ?? req.locale ?? undefined, headers: req.headers, req })
      if (config.recordingMode === 'none') return new Response(null, { status: 204, headers: headersWithCors({ headers: new Headers(), req }) })
      if (body.source === 'implicit' && !options.recording.implicit) {
        return new Response(null, { status: 204, headers: headersWithCors({ headers: new Headers(), req }) })
      }
      if (body.versions.policyVersion !== config.versions.policyVersion) {
        return json(req, { error: 'policy version changed', current: config.versions }, { status: 409 })
      }

      const knownKeys = new Set(config.categories.filter((c) => !c.required).map((c) => c.key))
      const decisions = Object.fromEntries(Object.entries(body.decisions).filter(([k]) => knownKeys.has(k)))
      const granted = Object.entries(decisions).filter(([, v]) => v).map(([k]) => k)
      const linkUser = config.recordingMode === 'linked' && options.usersSlug && req.user && req.user.collection === options.usersSlug

      const record = await req.payload.create({
        collection: options.slugs.records,
        data: {
          consentId: body.consentId,
          ...(linkUser ? { user: req.user!.id } : {}),
          decisions,
          grantedCategories: granted,
          source: body.source,
          country: config.jurisdiction.country ?? undefined,
          model: config.jurisdiction.model,
          locale: config.locale,
          versions: body.versions,
          userAgentFamily: options.recording.userAgent ? userAgentFamily(req.headers.get('user-agent')) : undefined,
          expiresAt: new Date(Date.now() + config.reconsent.expiresAfterMonths * MONTH_MS).toISOString(),
        } as never,
        overrideAccess: true,
        req,
      })
      return json(req, { id: record.id }, { status: 201, headers: { 'cache-control': 'no-store' } })
    },
  }

  const meEndpoint: Endpoint = {
    path: `${base}/records/me`,
    method: 'get',
    handler: async (req) => {
      if (!req.user || !options.usersSlug || req.user.collection !== options.usersSlug) {
        return json(req, { error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } })
      }
      const result = (await req.payload.find({
        collection: options.slugs.records,
        where: { user: { equals: req.user.id } },
        sort: '-createdAt',
        limit: 50,
        depth: 0,
        overrideAccess: true,
        req,
      })) as unknown as { docs: AnyDoc[] }
      return json(
        req,
        {
          docs: result.docs.map((d) => ({
            id: d.id,
            consentId: d.consentId,
            decisions: d.decisions,
            source: d.source,
            createdAt: d.createdAt,
            expiresAt: d.expiresAt,
            versions: d.versions,
          })),
        },
        { headers: { 'cache-control': 'no-store' } },
      )
    },
  }

  const preflight: Endpoint = {
    path: `${base}/:any`,
    method: 'options',
    handler: (req) => new Response(null, { status: 204, headers: headersWithCors({ headers: new Headers(), req }) }),
  }

  return [configEndpoint, recordsEndpoint, meEndpoint, preflight]
}

async function readBody(req: PayloadRequest): Promise<unknown | null> {
  try {
    const length = Number(req.headers.get('content-length') ?? 0)
    if (length > 4096) return null
    if (typeof req.json === 'function') return await req.json()
    return req.data ?? null
  } catch {
    return null
  }
}
