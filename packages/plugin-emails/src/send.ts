import type { Payload, PayloadRequest, SendEmailOptions } from 'payload'

import { getEmailDoc, getSettings, type RenderContext, renderEmail, resolveCopy, resolveVariables } from './render/render.js'
import type {
  EmailsAPI,
  EmailSettings,
  RenderArgs,
  RenderedEmail,
  SanitizedEmailDefinition,
  SanitizedEmailsPluginOptions,
  SendArgs,
  SendResult,
  TransactionalEmailDoc,
} from './types.js'
import { validateInput } from './validate-input.js'

export const SEND_TASK_SLUG = 'pluginEmailsSend'

export class EmailNotDefinedError extends Error {
  constructor(slug: string, known: Iterable<string>) {
    super(`[plugin-emails] No email is defined with slug "${slug}". Known: ${[...known].join(', ') || '(none)'}.`)
    this.name = 'EmailNotDefinedError'
  }
}

export function toList(value: string | string[] | undefined): string[] {
  if (!value) {
    return []
  }
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean)
}

function emailsFromRows(rows: Array<{ email: string }> | null | undefined): string[] {
  return (rows ?? []).map((r) => r.email).filter(Boolean)
}

type Prepared = {
  definition: SanitizedEmailDefinition
  doc: null | TransactionalEmailDoc
  rendered: RenderedEmail
  settings: EmailSettings
  variables: Record<string, unknown>
}

export async function prepare(
  ctx: RenderContext,
  definition: SanitizedEmailDefinition,
  input: Record<string, unknown>,
  { draft = false, variables: presetVariables }: { draft?: boolean; variables?: Record<string, unknown> } = {},
): Promise<Prepared> {
  const [doc, settings] = await Promise.all([getEmailDoc(ctx, definition.slug, { draft }), getSettings(ctx)])
  if (!doc) {
    ctx.payload.logger.warn(
      `[plugin-emails] No document for "${definition.slug}" — rendering code defaults. Run payload.emails.sync() to seed it.`,
    )
  }
  const variables = presetVariables
    ? { ...(await resolveVariables(ctx, { ...definition, resolve: undefined }, {}, settings)), ...presetVariables }
    : await resolveVariables(ctx, definition, input, settings)
  const copy = await resolveCopy(ctx, definition, doc)
  const rendered = await renderEmail(ctx, definition, copy, variables, settings)
  return { definition, doc, rendered, settings, variables }
}

export async function resolveRecipients(
  ctx: RenderContext,
  prepared: Prepared,
  input: Record<string, unknown>,
  override?: string | string[],
): Promise<string[]> {
  const { definition, doc, settings, variables } = prepared
  if (override) {
    return toList(override)
  }
  if (definition.to) {
    const to = await definition.to({ input: input as never, payload: ctx.payload, settings, variables: variables as never })
    const list = toList(to)
    if (list.length) {
      return list
    }
  }
  const fromDoc = emailsFromRows(doc?.recipients?.to)
  if (fromDoc.length) {
    return fromDoc
  }
  if (definition.audience === 'admin') {
    return settings.adminRecipients ?? []
  }
  return []
}

export function buildMessage(
  prepared: Prepared,
  to: string[],
  args: Pick<SendArgs, 'attachments' | 'bcc' | 'cc' | 'replyTo'>,
): SendEmailOptions {
  const { definition, doc, rendered, settings } = prepared
  const from = settings.from?.address
    ? settings.from.name
      ? { address: settings.from.address, name: settings.from.name }
      : settings.from.address
    : undefined
  const cc = [...toList(args.cc), ...emailsFromRows(doc?.recipients?.cc)]
  const bcc = [...toList(args.bcc), ...emailsFromRows(doc?.recipients?.bcc)]
  const replyTo = args.replyTo ?? doc?.recipients?.replyTo ?? settings.replyTo
  return {
    ...(from ? { from } : {}),
    ...(cc.length ? { cc } : {}),
    ...(bcc.length ? { bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(args.attachments?.length ? { attachments: args.attachments } : {}),
    headers: { 'X-Payload-Email': definition.slug },
    html: rendered.html,
    subject: rendered.subject,
    text: rendered.text,
    to,
  }
}

async function writeLog(
  payload: Payload,
  options: SanitizedEmailsPluginOptions,
  entry: {
    definition: SanitizedEmailDefinition
    durationMs?: number
    isTest?: boolean
    locale?: string
    message?: SendEmailOptions
    result: SendResult
    variables?: Record<string, unknown>
  },
): Promise<number | string | undefined> {
  const log = options.log
  if (!log?.enabled || (entry.isTest && !log.includeTests)) {
    return undefined
  }
  try {
    const created = await payload.create({
      collection: options.logSlug as never,
      data: {
        bcc: toList(entry.message?.bcc as never).join(', ') || undefined,
        cc: toList(entry.message?.cc as never).join(', ') || undefined,
        durationMs: entry.durationMs,
        error: entry.result.error,
        isTest: Boolean(entry.isTest),
        key: entry.definition.slug,
        locale: entry.locale,
        messageId: entry.result.messageId,
        reason: entry.result.reason,
        sentAt: new Date().toISOString(),
        status: entry.result.status,
        subject: entry.message?.subject,
        to: toList(entry.message?.to as never).join(', ') || undefined,
        ...(log.storeHtml ? { html: entry.message?.html } : {}),
        ...(log.storeVariables ? { variables: entry.variables } : {}),
      } as never,
      depth: 0,
      overrideAccess: true,
    })
    return (created as { id: number | string }).id
  } catch (error) {
    payload.logger.error({ err: error, msg: '[plugin-emails] Could not write email log entry' })
    return undefined
  }
}

function messageIdOf(response: unknown): string | undefined {
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>
    const id = r.messageId ?? r.id ?? (r.data as Record<string, unknown> | undefined)?.id
    return typeof id === 'string' ? id : undefined
  }
  return undefined
}

/** Deliver a prepared message: hooks, adapter, log. Shared by `send`, the job handler and test sends. */
export async function deliver(
  payload: Payload,
  options: SanitizedEmailsPluginOptions,
  prepared: Prepared,
  message: SendEmailOptions,
  input: Record<string, unknown>,
  meta: { isTest?: boolean; locale?: string },
): Promise<SendResult> {
  const started = Date.now()
  let msg = message
  for (const hook of [...(options.hooks?.beforeSend ?? [])]) {
    msg = await hook({ definition: prepared.definition, input, message: msg, payload, variables: prepared.variables })
  }

  let result: SendResult
  let error: unknown
  try {
    const response = await payload.sendEmail(msg)
    result = { messageId: messageIdOf(response), status: 'sent' }
  } catch (err) {
    error = err
    result = { error: err instanceof Error ? err.message : String(err), status: 'failed' }
    payload.logger.error({ err, msg: `[plugin-emails] Sending "${prepared.definition.slug}" failed` })
  }

  result.logId = await writeLog(payload, options, {
    definition: prepared.definition,
    durationMs: Date.now() - started,
    isTest: meta.isTest,
    locale: meta.locale,
    message: msg,
    result,
    variables: prepared.variables,
  })
  for (const hook of options.hooks?.afterSend ?? []) {
    await hook({ definition: prepared.definition, error, message: msg, payload, result })
  }
  return result
}

function getDefinition(options: SanitizedEmailsPluginOptions, slug: string): SanitizedEmailDefinition {
  const definition = options.definitions.get(slug)
  if (!definition) {
    throw new EmailNotDefinedError(slug, options.definitions.keys())
  }
  return definition
}

function maybeValidate(options: SanitizedEmailsPluginOptions, definition: SanitizedEmailDefinition, input: unknown): void {
  const mode = options.validateInput ?? 'development'
  if (mode === 'never' || (mode === 'development' && process.env.NODE_ENV === 'production')) {
    return
  }
  const errors = validateInput(definition.inputSchema, input ?? {})
  if (errors.length) {
    throw new Error(`[plugin-emails] Invalid input for "${definition.slug}": ${errors.join('; ')}`)
  }
}

function localeOf(payload: Payload, args: { locale?: string; req?: PayloadRequest }): string | undefined {
  return (
    args.locale ||
    (args.req?.locale as null | string | undefined) ||
    (payload.config.localization ? payload.config.localization.defaultLocale : undefined) ||
    undefined
  )
}

/** Strip populated documents down to ids so queued input is JSON-safe. */
export function serializeInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Date) {
      out[key] = value.toISOString()
    } else if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in (value as object)) {
      out[key] = (value as { id: unknown }).id
    } else {
      out[key] = value
    }
  }
  return out
}

export function createEmailsAPI(payload: Payload, options: SanitizedEmailsPluginOptions): EmailsAPI {
  const send = async (slug: string, args: SendArgs<any>): Promise<SendResult> => {
    const definition = getDefinition(options, slug)
    const input = (args.input ?? {}) as Record<string, unknown>
    maybeValidate(options, definition, input)
    const locale = localeOf(payload, args)
    const ctx: RenderContext = { locale, options, payload, req: args.req }

    const wantsQueue = args.queue ?? options.queue?.default ?? false
    if (wantsQueue) {
      if (!options.queue?.enabled) {
        throw new Error('[plugin-emails] `queue` was requested but `queue.enabled` is false in the plugin options.')
      }
      const queueArgs = typeof wantsQueue === 'object' ? wantsQueue : {}
      const job = await payload.jobs.queue({
        input: {
          args: {
            attachments: args.attachments,
            bcc: args.bcc,
            cc: args.cc,
            input: serializeInput(input),
            locale,
            replyTo: args.replyTo,
            to: args.to,
          },
          slug,
        },
        queue: queueArgs.queue ?? options.queue.queue,
        req: args.req,
        task: SEND_TASK_SLUG as never,
        waitUntil: queueArgs.waitUntil,
      } as never)
      const result: SendResult = { jobId: (job as { id: number | string }).id, status: 'queued' }
      result.logId = await writeLog(payload, options, { definition, locale, result })
      return result
    }

    // Gate before rendering: disabled, vetoed.
    const doc = await getEmailDoc(ctx, slug)
    if (doc && doc.enabled === false && !definition.required) {
      const result: SendResult = { reason: 'disabled', status: 'skipped' }
      result.logId = await writeLog(payload, options, { definition, locale, result })
      return result
    }
    for (const hook of [definition.shouldSend, ...(options.hooks?.shouldSend ?? [])]) {
      if (!hook) {
        continue
      }
      const verdict = await hook({ definition: definition as never, input: input as never, payload, req: args.req })
      if (verdict === false || (typeof verdict === 'object' && verdict.skip)) {
        const result: SendResult = { reason: typeof verdict === 'object' ? verdict.skip : 'vetoed', status: 'skipped' }
        result.logId = await writeLog(payload, options, { definition, locale, result })
        return result
      }
    }

    const prepared = await prepare(ctx, definition, input)
    const to = await resolveRecipients(ctx, prepared, input, args.to)
    if (!to.length) {
      payload.logger.warn(`[plugin-emails] "${slug}": no recipient. Pass \`to\`, define \`to()\`, or set recipients in the admin.`)
      const result: SendResult = { reason: 'no-recipient', status: 'skipped' }
      result.logId = await writeLog(payload, options, { definition, locale, result })
      return result
    }
    const message = buildMessage(prepared, to, args)
    return deliver(payload, options, prepared, message, input, { locale })
  }

  const render = async (slug: string, args: RenderArgs<any>): Promise<RenderedEmail> => {
    const definition = getDefinition(options, slug)
    const input = (args.input ?? {}) as Record<string, unknown>
    const ctx: RenderContext = { locale: localeOf(payload, args), options, payload, req: args.req }
    const prepared = await prepare(ctx, definition, input, { draft: args.draft })
    const to = await resolveRecipients(ctx, prepared, input)
    return { ...prepared.rendered, to }
  }

  const orphans = async () => {
    const { docs } = await payload.find({
      collection: options.collectionSlug as never,
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      where: { key: { not_in: [...options.definitions.keys()] } },
    })
    return (docs as TransactionalEmailDoc[]).map((d) => ({ id: d.id, key: d.key }))
  }

  return {
    definitions: options.definitions,
    orphans,
    render: render as EmailsAPI['render'],
    send: send as EmailsAPI['send'],
    sync: async () => {
      const { syncEmails } = await import('./seed.js')
      return syncEmails(payload, options)
    },
  }
}

/** Render with the document's (or code) sample input and send to one address. Used by the admin. */
export async function sendTest(
  payload: Payload,
  options: SanitizedEmailsPluginOptions,
  args: { draft?: boolean; input?: Record<string, unknown>; locale?: string; req?: PayloadRequest; slug: string; to: string },
): Promise<SendResult> {
  const definition = getDefinition(options, args.slug)
  const ctx: RenderContext = { locale: localeOf(payload, args), options, payload, req: args.req }
  const prepared = await prepare(ctx, definition, args.input ?? {}, { draft: args.draft ?? true })
  const message = buildMessage(prepared, [args.to], {})
  message.subject = `[TEST] ${message.subject}`
  return deliver(payload, options, prepared, message, args.input ?? {}, { isTest: true, locale: ctx.locale ?? undefined })
}

/** Resolve the input the preview should use: explicit → document sample → code sample → examples. */
export async function resolveSampleInput(
  payload: Payload,
  definition: SanitizedEmailDefinition,
  doc: null | TransactionalEmailDoc,
  explicit?: Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  if (explicit && Object.keys(explicit).length) {
    return explicit
  }
  if (doc?.sampleInput && Object.keys(doc.sampleInput).length) {
    return doc.sampleInput
  }
  if (definition.sample) {
    return (typeof definition.sample === 'function'
      ? await definition.sample({ payload })
      : definition.sample) as Record<string, unknown>
  }
  const fromExamples: Record<string, unknown> = {}
  for (const field of definition.inputSchema ?? []) {
    if ('name' in field && field.name) {
      const example = definition.variables[field.name]?.example
      fromExamples[field.name] = example ?? `{${field.name}}`
    }
  }
  return fromExamples
}
