import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload, PayloadRequest } from 'payload'

import { Link, Text } from '@react-email/components'
import { render } from '@react-email/render'
import React from 'react'

import type {
  CampaignDoc,
  NewsletterSettings,
  RenderedCampaign,
  RenderMode,
  SanitizedOptions,
  Subscriber,
  VariableInfo,
} from '../types.js'
import type { TokenResolver } from './interpolate.js'

import { FULL_NAME_PROPERTY, RESEND_UNSUBSCRIBE_PLACEHOLDER } from '../constants.js'
import { interpolate, toPlaceholderFallback } from './interpolate.js'
import { lexicalToReact } from './lexical-react.js'
import { defaultStyles, EMAIL_CLASS } from './template.js'

/** Tokens that differ per subscriber, and the Resend contact field each one maps to. */
const SUBSCRIBER_TOKENS: Record<string, { description: string; field: string }> = {
  name: { description: 'Full name', field: FULL_NAME_PROPERTY },
  email: { description: 'Email address', field: 'email' },
  firstName: { description: 'Given name (first word of the name)', field: 'first_name' },
  lastName: { description: 'Family name (the rest of the name)', field: 'last_name' },
}

/** Values the same for everyone, inlined at send time. */
export async function resolveGlobals(
  payload: Payload,
  options: SanitizedOptions,
  settings: NewsletterSettings,
): Promise<Record<string, number | string>> {
  const own =
    typeof options.variables === 'function'
      ? await options.variables({ payload })
      : (options.variables ?? {})
  return {
    'site.name': settings.siteName ?? '',
    'site.url': settings.siteUrl ?? payload.config.serverURL ?? '',
    year: new Date().getFullYear(),
    ...own,
  }
}

/** Every token a campaign may use, with what it becomes in a broadcast. */
export function variableCatalog(
  options: SanitizedOptions,
  globals: Record<string, number | string>,
): VariableInfo[] {
  const out: VariableInfo[] = Object.entries(SUBSCRIBER_TOKENS).map(([token, spec]) => ({
    type: 'subscriber' as const,
    description: spec.description,
    resend: `{{{contact.${spec.field}}}}`,
    token,
  }))
  out.push({
    type: 'subscriber',
    description: 'Per-subscriber unsubscribe link (the footer already has one)',
    resend: RESEND_UNSUBSCRIBE_PLACEHOLDER,
    token: 'unsubscribeUrl',
  })
  for (const [key, spec] of Object.entries(options.properties)) {
    out.push({
      type: 'property',
      description: spec.description,
      resend: `{{{contact.${key}}}}`,
      token: key,
    })
  }
  for (const [key, value] of Object.entries(globals)) {
    out.push({
      type: 'global',
      description: 'Same for every subscriber',
      resend: String(value),
      token: key,
    })
  }
  return out
}

/** Names allowed in the body (everything) and in subject/preview text (only what is the same for everyone). */
export function allowedTokens(options: SanitizedOptions, globals: Record<string, unknown>) {
  const everyone = new Set(Object.keys(globals))
  const body = new Set([
    'unsubscribeUrl',
    ...everyone,
    ...Object.keys(options.properties),
    ...Object.keys(SUBSCRIBER_TOKENS),
  ])
  return { body, everyone }
}

type ResolverArgs = {
  globals: Record<string, number | string>
  mode: RenderMode
  options: SanitizedOptions
  subscriber?: Subscriber
  unsubscribeUrl: string
}

/**
 * The heart of the plugin's two render modes. In `preview` every token is filled from one subscriber,
 * so the admin (and a test send) shows exactly what that person would read. In `broadcast` the
 * per-subscriber tokens become Resend placeholders — `{{{contact.first_name|there}}}` — and Resend
 * fills them in for each contact when it sends; values that are the same for everyone are inlined.
 */
export function createResolver({
  globals,
  mode,
  options,
  subscriber,
  unsubscribeUrl,
}: ResolverArgs): {
  resolve: TokenResolver
  used: Record<string, string>
} {
  const used: Record<string, string> = {}
  const resolve: TokenResolver = (name, fallback) => {
    const value = resolveOne(name, fallback)
    if (value !== undefined) {
      used[name] = value
    }
    return value
  }

  const resolveOne = (name: string, fallback: string | undefined): string | undefined => {
    if (name === 'unsubscribeUrl') {
      return unsubscribeUrl
    }
    const builtIn = SUBSCRIBER_TOKENS[name]
    const property = options.properties[name]
    if (mode === 'broadcast' && (builtIn || property)) {
      const field = builtIn ? builtIn.field : name
      const fb =
        fallback ?? (property?.fallback !== undefined ? String(property.fallback) : undefined)
      const cleaned = fb === undefined ? '' : toPlaceholderFallback(fb)
      return cleaned ? `{{{contact.${field}|${cleaned}}}}` : `{{{contact.${field}}}}`
    }
    if (builtIn || property) {
      let value = ''
      if (builtIn && subscriber) {
        value = subscriber[name as 'email' | 'firstName' | 'lastName' | 'name'] ?? ''
      } else if (property && subscriber) {
        const raw = subscriber.properties[name]
        value = raw === null || raw === undefined ? '' : String(raw)
      }
      if (!value && property?.fallback !== undefined && fallback === undefined) {
        return String(property.fallback)
      }
      return value || fallback || ''
    }
    if (Object.prototype.hasOwnProperty.call(globals, name)) {
      const value = String(globals[name] ?? '')
      return value || fallback || ''
    }
    return undefined
  }

  return { resolve, used }
}

export type RenderCampaignArgs = {
  /** Turns an upload's URL into a public one. Image blocks must already hold their media documents. */
  imageUrl?: (url: string) => string
  campaign: Pick<CampaignDoc, 'body' | 'previewText' | 'subject' | 'template'>
  globals: Record<string, number | string>
  mode: RenderMode
  options: SanitizedOptions
  settings: NewsletterSettings
  subscriber?: Subscriber
}

export async function renderCampaign({
  imageUrl,
  campaign,
  globals,
  mode,
  options,
  settings,
  subscriber,
}: RenderCampaignArgs): Promise<RenderedCampaign> {
  const template =
    (campaign.template && options.templates[campaign.template]) || options.templates.default
  const styles = { ...defaultStyles, ...(template.styles ?? {}) }
  const unsubscribeUrl =
    mode === 'broadcast' ? RESEND_UNSUBSCRIBE_PLACEHOLDER : previewUnsubscribeUrl(settings)
  const { resolve, used } = createResolver({ globals, mode, options, subscriber, unsubscribeUrl })

  // Subject and preview text only take values that are the same for everyone (see collection validation).
  const everyoneResolver = createResolver({
    globals,
    mode: 'preview',
    options,
    unsubscribeUrl,
  }).resolve
  const subject = interpolate(campaign.subject ?? '', everyoneResolver)
  const preheader = campaign.previewText
    ? interpolate(campaign.previewText, everyoneResolver)
    : undefined

  const renderOptions = { imageUrl, resolve, styles: template.styles }
  const body = lexicalToReact(campaign.body as SerializedEditorState | undefined, renderOptions)
  // Footer copy is small print: body styles would render it at reading size.
  const footerText = { color: 'inherit', fontSize: '12px', lineHeight: '1.5', margin: '0 0 8px' }
  const footerCopy = settings.footer
    ? lexicalToReact(settings.footer, {
        imageUrl,
        resolve,
        styles: {
          ...template.styles,
          link: { ...styles.link, color: 'inherit' },
          text: footerText,
        },
      })
    : null
  const footer = (
    <>
      {footerCopy}
      <Text
        className={EMAIL_CLASS.fine}
        style={{ ...styles.fine, color: 'inherit', fontSize: '12px', margin: '8px 0 0' }}
      >
        <Link
          className={EMAIL_CLASS.link}
          href={unsubscribeUrl}
          style={{ ...styles.link, color: 'inherit' }}
        >
          {settings.unsubscribeLabel || 'Unsubscribe'}
        </Link>
      </Text>
    </>
  )

  const element = template({
    children: body,
    footer,
    preheader,
    settings,
    subject,
    unsubscribeUrl,
    variables: used,
  })
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { html, preheader, subject, text: text.trim(), variables: used }
}

/** Where the unsubscribe link points in previews and test sends: nowhere that unsubscribes anybody. */
export function previewUnsubscribeUrl(settings: NewsletterSettings): string {
  const base = settings.siteUrl?.replace(/\/$/, '')
  return base ? `${base}/#unsubscribe-preview` : '#unsubscribe-preview'
}

export async function getSettings(
  payload: Payload,
  options: SanitizedOptions,
  req?: PayloadRequest,
): Promise<NewsletterSettings> {
  try {
    const doc = (await payload.findGlobal({
      slug: options.slugs.settings as never,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Record<string, any>
    return {
      footer: doc.footer ?? null,
      from: doc.from || undefined,
      replyTo: doc.replyTo || undefined,
      siteName: doc.siteName || undefined,
      siteUrl: doc.siteUrl || payload.config.serverURL || undefined,
      testRecipient: doc.testRecipient || undefined,
      unsubscribeLabel: doc.unsubscribeLabel || undefined,
    }
  } catch (error) {
    payload.logger.warn({
      err: error,
      msg: '[plugin-resend-broadcasts] Could not read Newsletter Settings; using defaults.',
    })
    return { siteUrl: payload.config.serverURL || undefined }
  }
}

/** A stand-in subscriber for previews when a list has nobody in it yet. */
export function sampleSubscriber(options: SanitizedOptions): Subscriber {
  const properties: Subscriber['properties'] = {}
  for (const [key, spec] of Object.entries(options.properties)) {
    properties[key] = spec.fallback ?? (spec.type === 'number' ? 0 : `[${key}]`)
  }
  return {
    id: 'sample',
    name: 'Ada Lovelace',
    collection: options.sources[0].collection,
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    properties,
    subscribed: true,
  }
}
