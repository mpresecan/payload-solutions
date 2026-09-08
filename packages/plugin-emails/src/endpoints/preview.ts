import type { Endpoint, PayloadRequest } from 'payload'

import { type RenderContext, resolveVariables } from '../render/render.js'
import { DEFAULT_GLOBAL_MANIFEST, getEmailDoc } from '../render/render.js'
import { prepare, resolveRecipients, resolveSampleInput, sendTest } from '../send.js'
import type { SanitizedEmailsPluginOptions, TransactionalEmailDoc } from '../types.js'

type PreviewBody = {
  draft?: boolean
  input?: null | Record<string, unknown>
  locale?: string
  to?: string
}

async function readBody(req: PayloadRequest): Promise<PreviewBody> {
  try {
    return ((await req.json?.()) ?? {}) as PreviewBody
  } catch {
    return {}
  }
}

async function loadDoc(req: PayloadRequest, options: SanitizedEmailsPluginOptions, draft: boolean, locale?: string) {
  const id = req.routeParams?.id as string | undefined
  if (!id) {
    return null
  }
  return (await req.payload.findByID({
    id,
    collection: options.collectionSlug as never,
    depth: 0,
    draft,
    locale: locale as never,
    overrideAccess: true,
    req,
  })) as TransactionalEmailDoc
}

function exampleVariables(options: SanitizedEmailsPluginOptions, slug: string): Record<string, unknown> {
  const definition = options.definitions.get(slug)!
  const out: Record<string, unknown> = {}
  for (const [name, spec] of Object.entries(definition.variables)) {
    out[name] = spec.example ?? `[${name}]`
  }
  return out
}

/** `POST /api/<collection>/:id/preview` → `{ subject, preheader, html, text, to, variables, usedSample }` */
export function createPreviewEndpoint(options: SanitizedEmailsPluginOptions): Endpoint {
  return {
    handler: async (req) => {
      if (!req.user) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 })
      }
      const body = await readBody(req)
      const locale = body.locale ?? (req.locale as string | undefined)
      const draft = body.draft ?? true
      const doc = await loadDoc(req, options, draft, locale)
      const definition = doc ? options.definitions.get(doc.key) : undefined
      if (!doc || !definition) {
        return Response.json({ message: 'This email is no longer defined in code.' }, { status: 404 })
      }

      const ctx: RenderContext = { locale, options, payload: req.payload, req }
      const input = await resolveSampleInput(req.payload, definition, doc, body.input)
      let warning: string | undefined
      let prepared
      try {
        prepared = await prepare(ctx, definition, input, { draft })
      } catch (error) {
        // Sample input could not be resolved (e.g. a relationship id that does not exist): fall back to
        // the manifest examples so editors still see the layout and copy.
        warning = `Sample input could not be resolved (${error instanceof Error ? error.message : String(error)}). Showing example values instead.`
        prepared = await prepare(ctx, definition, {}, { draft, variables: exampleVariables(options, definition.slug) })
      }
      let to: string[] = []
      try {
        to = await resolveRecipients(ctx, prepared, input)
      } catch {
        to = []
      }
      const { rendered } = prepared
      return Response.json({
        html: rendered.html,
        input,
        // Split so the panel can show what this email defines and what is available everywhere,
        // each next to the value it actually resolved to for this render.
        manifest: {
          email: definition.variables,
          global: options.globalVariableManifest ?? DEFAULT_GLOBAL_MANIFEST,
        },
        preheader: rendered.preheader,
        subject: rendered.subject,
        text: rendered.text,
        to,
        variables: rendered.variables,
        warning,
      })
    },
    method: 'post',
    path: '/:id/preview',
  }
}

/** `POST /api/<collection>/:id/send-test` with `{ to, input?, locale?, draft? }` */
export function createSendTestEndpoint(options: SanitizedEmailsPluginOptions): Endpoint {
  return {
    handler: async (req) => {
      if (!req.user) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 })
      }
      const body = await readBody(req)
      const to = typeof body.to === 'string' ? body.to.trim() : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return Response.json({ message: 'Enter a valid email address.' }, { status: 400 })
      }
      const locale = body.locale ?? (req.locale as string | undefined)
      const draft = body.draft ?? true
      const doc = await loadDoc(req, options, draft, locale)
      const definition = doc ? options.definitions.get(doc.key) : undefined
      if (!doc || !definition) {
        return Response.json({ message: 'This email is no longer defined in code.' }, { status: 404 })
      }
      const input = await resolveSampleInput(req.payload, definition, doc, body.input)
      try {
        const result = await sendTest(req.payload, options, { draft, input, locale, req, slug: definition.slug, to })
        return Response.json(result, { status: result.status === 'failed' ? 502 : 200 })
      } catch (error) {
        return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
      }
    },
    method: 'post',
    path: '/:id/send-test',
  }
}

// Re-exported for the RSC preview view, which pre-renders once on the server.
export { getEmailDoc, resolveVariables }
