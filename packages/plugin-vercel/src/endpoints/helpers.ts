import type { Access, PayloadRequest } from 'payload'

import type { Ctx } from '../store.js'

export { ENDPOINT_BASE } from '../constants.js'

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function error(message: string, status: number): Response {
  return Response.json({ errors: [{ message }], message }, { status })
}

export async function allowed(access: Access, req: PayloadRequest): Promise<boolean> {
  try {
    const result = await access({ req })
    return Boolean(result)
  } catch {
    return false
  }
}

export async function readJson<T extends object>(req: PayloadRequest): Promise<T> {
  try {
    const body = (await req.json?.()) as T | undefined
    return body ?? ({} as T)
  } catch {
    return {} as T
  }
}

export function queryParam(req: PayloadRequest, name: string): string | undefined {
  const value = req.query?.[name]
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  try {
    return new URL(req.url ?? '', 'http://localhost').searchParams.get(name) ?? undefined
  } catch {
    return undefined
  }
}

/** Only ever hand the client what it needs: no hook URLs, tokens or secrets. */
export function publicTargets(ctx: Ctx) {
  return ctx.options.targets.map((t) => ({
    configured: t.configured,
    label: t.label,
    projectId: t.projectId,
    slug: t.slug,
    tokenConfigured: Boolean(t.token),
    url: t.url,
  }))
}
