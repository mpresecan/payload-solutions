import type { Payload, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { ResendClient } from './resend/client.js'
import type {
  CampaignDoc,
  ListDoc,
  RenderedCampaign,
  RenderMode,
  SanitizedOptions,
  Subscriber,
} from './types.js'

import { INTERNAL_WRITE, RESEND_UNSUBSCRIBE_PLACEHOLDER } from './constants.js'
import { getSettings, renderCampaign, resolveGlobals, sampleSubscriber } from './render/render.js'
import { absoluteUrl, findPrivateImages, populateImageBlocks } from './render/images.js'
import { isNotFound } from './resend/client.js'

export type CampaignContext = {
  client: ResendClient
  options: SanitizedOptions
  payload: Payload
  req?: PayloadRequest
}

/**
 * Images a reader's mail client could not load: a URL that is not public, or a file Payload serves
 * only to logged-in users. The URL check is skipped with `media.allowPrivateUrls`; the access check
 * never is, because no setting makes a login-only file reachable from an inbox.
 */
export function imagesReadersCannotLoad(
  options: SanitizedOptions,
  rendered: RenderedCampaign,
): string[] {
  if (!options.media) {
    return []
  }
  const urls = options.media.allowPrivateUrls ? [] : findPrivateImages(rendered.html)
  return [...new Set([...urls, ...(rendered.loginRequiredImages ?? [])])]
}

/** Statuses in which the copy is frozen: Resend already has (or had) the email. */
export const LOCKED_STATUSES = new Set(['scheduled', 'sending', 'sent'])

export async function loadCampaign(
  ctx: CampaignContext,
  id: number | string,
): Promise<CampaignDoc> {
  return (await ctx.payload.findByID({
    id,
    collection: ctx.options.slugs.campaigns as never,
    depth: 1,
    overrideAccess: !ctx.req?.user,
    req: ctx.req,
    user: ctx.req?.user,
  })) as unknown as CampaignDoc
}

export function campaignList(campaign: CampaignDoc): ListDoc | null {
  return campaign.list && typeof campaign.list === 'object' ? campaign.list : null
}

export async function renderFor(
  ctx: CampaignContext,
  campaign: CampaignDoc,
  { mode, subscriber }: { mode: RenderMode; subscriber?: Subscriber },
): Promise<RenderedCampaign> {
  const settings = await getSettings(ctx.payload, ctx.options, ctx.req)
  const globals = await resolveGlobals(ctx.payload, ctx.options, settings)
  const { media } = ctx.options
  const imageUrl = media
    ? (url: string) =>
        absoluteUrl(
          url,
          media.baseUrl ?? ctx.payload.config.serverURL ?? settings.siteUrl,
          ctx.payload.config.serverURL,
        )
    : undefined
  const loginRequired: string[] = []
  const populate = async (body: CampaignDoc['body']) => {
    if (!media) {
      return body
    }
    const result = await populateImageBlocks({
      body,
      collection: media.collection,
      payload: ctx.payload,
      req: ctx.req,
    })
    loginRequired.push(...result.loginRequired.map((doc) => imageUrl!(doc.url!)))
    return result.body
  }
  const [body, footer] = await Promise.all([populate(campaign.body), populate(settings.footer)])
  const rendered = await renderCampaign({
    campaign: { ...campaign, body },
    imageUrl,
    globals,
    mode,
    options: ctx.options,
    settings: { ...settings, footer },
    subscriber: mode === 'preview' ? (subscriber ?? sampleSubscriber(ctx.options)) : undefined,
  })
  return { ...rendered, loginRequiredImages: [...new Set(loginRequired)] }
}

async function senders(ctx: CampaignContext, campaign: CampaignDoc) {
  const settings = await getSettings(ctx.payload, ctx.options, ctx.req)
  const from = campaign.from || settings.from || ctx.options.from
  if (!from) {
    throw new APIError(
      'No sender. Set "From" on the campaign or in Newsletter Settings, or pass `from` to the plugin.',
      400,
      undefined,
      true,
    )
  }
  const replyTo = campaign.replyTo || settings.replyTo || ctx.options.replyTo || undefined
  return { from, replyTo }
}

/** Send the campaign to one address, filled in for one subscriber. Goes through Resend's email API. */
export async function sendTest(
  ctx: CampaignContext,
  campaign: CampaignDoc,
  { subscriber, to }: { subscriber?: Subscriber; to: string },
): Promise<{ id: string }> {
  if (!to || !/^[^\s@]+@[^\s@]+$/.test(to)) {
    throw new APIError('Enter a valid recipient address for the test.', 400, undefined, true)
  }
  const rendered = await renderFor(ctx, campaign, { mode: 'preview', subscriber })
  const { from, replyTo } = await senders(ctx, campaign)
  const sent = await ctx.client.call('send test email', (r) =>
    r.emails.send({
      from,
      html: rendered.html,
      replyTo,
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text,
      to,
    }),
  )
  return { id: sent.id }
}

/**
 * Hand the campaign to Resend as a broadcast to its list's segment — now, or at `scheduledAt`.
 * The copy is rendered once, with per-subscriber variables left as Resend placeholders.
 */
export async function sendCampaign(
  ctx: CampaignContext,
  id: number | string,
  { scheduledAt }: { scheduledAt?: Date | string } = {},
): Promise<CampaignDoc> {
  const campaign = await loadCampaign(ctx, id)
  if (LOCKED_STATUSES.has(campaign.status ?? 'draft')) {
    throw new APIError(`This campaign is already ${campaign.status}.`, 409, undefined, true)
  }
  const list = campaignList(campaign)
  if (!list) {
    throw new APIError('Choose a list before sending.', 400, undefined, true)
  }
  if (!list.segmentId) {
    throw new APIError(
      `The list "${list.name}" has no Resend segment yet. Resync it first.`,
      400,
      undefined,
      true,
    )
  }
  if (!campaign.subject?.trim()) {
    throw new APIError('The campaign has no subject.', 400, undefined, true)
  }

  let when: string | undefined
  if (scheduledAt) {
    const date = new Date(scheduledAt)
    if (Number.isNaN(date.getTime())) {
      throw new APIError('The scheduled time is not a valid date.', 400, undefined, true)
    }
    if (date.getTime() < Date.now() + 60_000) {
      throw new APIError('Schedule at least a minute ahead, or send now.', 400, undefined, true)
    }
    when = date.toISOString()
  }

  const rendered = await renderFor(ctx, campaign, { mode: 'broadcast' })
  if (!rendered.html.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER)) {
    throw new APIError(
      'The rendered email has no unsubscribe link. The template must render the `footer` prop (or link to `unsubscribeUrl`).',
      400,
      undefined,
      true,
    )
  }
  const privateImages = imagesReadersCannotLoad(ctx.options, rendered)
  if (privateImages.length) {
    throw new APIError(
      `Readers could not load ${privateImages.length === 1 ? 'this image' : 'these images'}: ${privateImages.join(', ')}. Images must be on a public URL that needs no login — make the media collection readable by everyone, set \`media.baseUrl\` (or serverURL) to your public site, or serve uploads from public storage.`,
      400,
      undefined,
      true,
    )
  }
  const { from, replyTo } = await senders(ctx, campaign)

  try {
    const created = await ctx.client.call('create broadcast', (r) =>
      r.broadcasts.create({
        name: campaign.name,
        from,
        html: rendered.html,
        previewText: rendered.preheader,
        replyTo,
        segmentId: list.segmentId!,
        send: true,
        subject: rendered.subject,
        text: rendered.text,
        ...(when ? { scheduledAt: when } : {}),
      } as never),
    )
    return await writeCampaign(ctx, campaign.id, {
      broadcastId: created.id,
      lastError: null,
      scheduledAt: when ?? null,
      sentAt: null,
      status: when ? 'scheduled' : 'sending',
    })
  } catch (error) {
    await writeCampaign(ctx, campaign.id, {
      lastError: error instanceof Error ? error.message : String(error),
      status: 'failed',
    })
    throw error
  }
}

/** Cancel a scheduled broadcast and return the campaign to draft so it can be edited again. */
export async function cancelCampaign(
  ctx: CampaignContext,
  id: number | string,
): Promise<CampaignDoc> {
  const campaign = await loadCampaign(ctx, id)
  if (campaign.status !== 'scheduled' || !campaign.broadcastId) {
    throw new APIError('Only a scheduled campaign can be cancelled.', 409, undefined, true)
  }
  await ctx.client.call('cancel broadcast', (r) => r.broadcasts.cancel(campaign.broadcastId!))
  try {
    await ctx.client.call('delete cancelled broadcast', (r) =>
      r.broadcasts.remove(campaign.broadcastId!),
    )
  } catch (error) {
    ctx.payload.logger.warn({
      err: error,
      msg: '[plugin-resend-broadcasts] Could not delete the cancelled broadcast.',
    })
  }
  return writeCampaign(ctx, campaign.id, {
    broadcastId: null,
    lastError: null,
    scheduledAt: null,
    status: 'draft',
  })
}

/** Ask Resend where a scheduled or sending broadcast is, and record it. */
export async function refreshCampaign(
  ctx: CampaignContext,
  id: number | string,
): Promise<CampaignDoc> {
  const campaign = await loadCampaign(ctx, id)
  if (!campaign.broadcastId || !['scheduled', 'sending'].includes(campaign.status ?? '')) {
    return campaign
  }
  let remote: { scheduled_at: null | string; sent_at: null | string; status: string }
  try {
    remote = (await ctx.client.call('get broadcast', (r) =>
      r.broadcasts.get(campaign.broadcastId!),
    )) as typeof remote
  } catch (error) {
    if (isNotFound(error)) {
      return writeCampaign(ctx, campaign.id, {
        broadcastId: null,
        lastError: 'The broadcast no longer exists in Resend.',
        status: 'failed',
      })
    }
    throw error
  }
  if (remote.status === 'sent') {
    return writeCampaign(ctx, campaign.id, {
      sentAt: remote.sent_at ?? new Date().toISOString(),
      status: 'sent',
    })
  }
  if (remote.status === 'draft') {
    // Cancelled from the Resend dashboard.
    return writeCampaign(ctx, campaign.id, {
      broadcastId: null,
      scheduledAt: null,
      status: 'draft',
    })
  }
  const isFuture = remote.scheduled_at && new Date(remote.scheduled_at).getTime() > Date.now()
  const status = isFuture ? 'scheduled' : 'sending'
  return status === campaign.status ? campaign : writeCampaign(ctx, campaign.id, { status })
}

async function writeCampaign(
  ctx: CampaignContext,
  id: number | string,
  data: Partial<CampaignDoc>,
): Promise<CampaignDoc> {
  return (await ctx.payload.update({
    id,
    collection: ctx.options.slugs.campaigns as never,
    context: { [INTERNAL_WRITE]: true },
    data: data as never,
    depth: 1,
    overrideAccess: true,
    req: ctx.req,
  })) as unknown as CampaignDoc
}
