import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import type {
  EmailSettings,
  RenderedEmail,
  SanitizedEmailDefinition,
  SanitizedEmailsPluginOptions,
  TransactionalEmailDoc,
  VariableManifest,
} from '../types.js'

import { render } from '@react-email/render'

import { flattenVariables, interpolate } from './interpolate.js'
import { lexicalToReact } from './lexical-react.js'
import { isSerializedEditorState, markdownToLexical } from './markdown.js'

export type RenderContext = {
  locale?: string
  options: SanitizedEmailsPluginOptions
  payload: Payload
  req?: PayloadRequest
}

export function pickLocalized(value: Record<string, string> | string | undefined, locale?: string): string {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return (locale && value[locale]) ?? value.en ?? Object.values(value)[0] ?? ''
}

/** Accepts an id or a populated document and returns the document. */
export async function populate<T = Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  value: unknown,
  args: { depth?: number; locale?: string; req?: PayloadRequest } = {},
): Promise<T> {
  if (value && typeof value === 'object') {
    return value as T
  }
  if (value === null || value === undefined || value === '') {
    throw new Error(`[plugin-emails] Cannot populate "${collection}": no id given.`)
  }
  return (await payload.findByID({
    id: value as number | string,
    collection,
    depth: args.depth ?? 0,
    locale: args.locale as never,
    overrideAccess: true,
    req: args.req,
  })) as T
}

export async function getSettings(ctx: RenderContext): Promise<EmailSettings> {
  const { locale, options, payload, req } = ctx
  if (options.settings === false) {
    return { adminRecipients: options.settings === false ? [] : undefined }
  }
  try {
    const doc = (await payload.findGlobal({
      slug: options.settingsSlug as never,
      depth: 0,
      locale: locale as never,
      overrideAccess: true,
      req,
    })) as Record<string, any>
    return {
      adminRecipients: (doc.adminRecipients ?? []).map((r: { email: string }) => r.email).filter(Boolean),
      footer: doc.footer ?? null,
      from: { address: doc.from?.address || undefined, name: doc.from?.name || undefined },
      replyTo: doc.replyTo || undefined,
      siteName: doc.siteName || undefined,
      siteUrl: doc.siteUrl || payload.config.serverURL || undefined,
      testRecipient: doc.testRecipient || undefined,
    }
  } catch (error) {
    payload.logger.warn({ err: error, msg: '[plugin-emails] Could not read email settings; using defaults.' })
    return {}
  }
}

export async function getEmailDoc(
  ctx: RenderContext,
  slug: string,
  { draft = false }: { draft?: boolean } = {},
): Promise<null | TransactionalEmailDoc> {
  const { locale, options, payload, req } = ctx
  const { docs } = await payload.find({
    collection: options.collectionSlug as never,
    depth: 0,
    draft,
    limit: 1,
    locale: locale as never,
    overrideAccess: true,
    pagination: false,
    req,
    where: { key: { equals: slug } },
  })
  return (docs[0] as TransactionalEmailDoc | undefined) ?? null
}

export async function resolveVariables(
  ctx: RenderContext,
  definition: SanitizedEmailDefinition,
  input: Record<string, unknown>,
  settings: EmailSettings,
): Promise<Record<string, unknown>> {
  const { locale, options, payload, req } = ctx
  const globals = options.globalVariables
    ? await options.globalVariables({ locale, payload, settings })
    : defaultGlobalVariables(settings)
  const own = definition.resolve
    ? await definition.resolve({ input: input as never, locale, payload, req, settings })
    : input
  let variables = { ...flattenVariables(globals as Record<string, unknown>), ...flattenVariables(own as Record<string, unknown>) }

  for (const hook of options.hooks?.beforeRender ?? []) {
    variables = await hook({ definition, payload, variables })
  }

  if (process.env.NODE_ENV !== 'production') {
    const manifest = definition.variables
    const missing = Object.keys(manifest).filter((name) => !(name in variables))
    if (missing.length) {
      payload.logger.warn(
        `[plugin-emails] "${definition.slug}": resolve() did not return ${missing.map((m) => `{{${m}}}`).join(', ')}.`,
      )
    }
  }
  return variables
}

export function defaultGlobalVariables(settings: EmailSettings): Record<string, unknown> {
  return {
    'site.name': settings.siteName ?? '',
    'site.url': settings.siteUrl ?? '',
    'support.email': settings.replyTo ?? settings.from?.address ?? '',
    year: new Date().getFullYear(),
  }
}

export const DEFAULT_GLOBAL_MANIFEST: VariableManifest = {
  'site.name': { description: 'Site name from email settings' },
  'site.url': { description: 'Site URL from email settings', type: 'url' },
  'support.email': { description: 'Reply-to or from address' },
  year: { description: 'Current year', type: 'number' },
}

export function fullManifest(options: SanitizedEmailsPluginOptions, definition: SanitizedEmailDefinition): VariableManifest {
  return { ...(options.globalVariableManifest ?? DEFAULT_GLOBAL_MANIFEST), ...definition.variables }
}

type Copy = { body: SerializedEditorState; preheader?: string; subject: string }

/** The editor-owned copy: from the document when present, otherwise from code defaults. */
export async function resolveCopy(
  ctx: RenderContext,
  definition: SanitizedEmailDefinition,
  doc: null | TransactionalEmailDoc,
): Promise<Copy> {
  const { locale, payload } = ctx
  if (doc?.subject && doc.body) {
    return { body: doc.body, preheader: doc.preheader ?? undefined, subject: doc.subject }
  }
  const { defaults } = definition
  const body = isSerializedEditorState(defaults.body)
    ? defaults.body
    : await markdownToLexical(payload.config, pickLocalized(defaults.body, locale))
  return {
    body,
    preheader: pickLocalized(defaults.preheader, locale) || undefined,
    subject: pickLocalized(defaults.subject, locale),
  }
}

export async function renderEmail(
  ctx: RenderContext,
  definition: SanitizedEmailDefinition,
  copy: Copy,
  variables: Record<string, unknown>,
  settings: EmailSettings,
): Promise<RenderedEmail> {
  const { locale, options } = ctx
  const manifest = fullManifest(options, definition)
  const template = options.templates[definition.template] ?? options.templates.default!

  const subject = interpolate(copy.subject, variables, {
    dateFormat: options.dateFormat,
    locale,
    manifest,
    mode: 'text',
  })
  const preheader = copy.preheader
    ? interpolate(copy.preheader, variables, { dateFormat: options.dateFormat, locale, manifest, mode: 'text' })
    : undefined

  const renderOptions = {
    dateFormat: options.dateFormat,
    locale,
    manifest,
    styles: template.styles,
    variables,
  }
  const body = lexicalToReact(copy.body, renderOptions)
  const footer = settings.footer
    ? lexicalToReact(settings.footer, {
        ...renderOptions,
        manifest: options.globalVariableManifest ?? DEFAULT_GLOBAL_MANIFEST,
      })
    : null

  const element = template({
    children: body,
    definition,
    footer,
    locale,
    preheader,
    settings,
    subject,
    variables,
  })

  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])

  return { html, preheader, subject, text: text.trim(), variables }
}
