import type { ResendBroadcastsPluginOptions, SanitizedOptions, SanitizedSource } from './types.js'

import {
  DEFAULT_SLUGS,
  FULL_NAME_PROPERTY,
  PROPERTY_KEY_PATTERN,
  RESERVED_TOKENS,
} from './constants.js'
import { DefaultTemplate } from './render/template.js'

const isLoggedIn = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export function sanitizeOptions(options: ResendBroadcastsPluginOptions): SanitizedOptions {
  if (!options.sources?.length) {
    throw new Error('[plugin-resend-broadcasts] `sources` needs at least one collection.')
  }

  const seen = new Set<string>()
  const properties: SanitizedOptions['properties'] = {}
  const sources: SanitizedSource[] = options.sources.map((source) => {
    if (seen.has(source.collection)) {
      throw new Error(`[plugin-resend-broadcasts] Source "${source.collection}" is listed twice.`)
    }
    seen.add(source.collection)

    for (const [key, definition] of Object.entries(source.properties ?? {})) {
      assertPropertyKey(source.collection, key)
      const existing = properties[key]
      if (existing && existing.type !== definition.type) {
        throw new Error(
          `[plugin-resend-broadcasts] Contact property "${key}" is "${existing.type}" in one source and "${definition.type}" in "${source.collection}". Resend stores one type per key.`,
        )
      }
      properties[key] = {
        type: definition.type,
        description: definition.description,
        fallback: definition.fallback,
      }
    }

    const fields = source.fields ?? {}
    const hasSplitName = Boolean(fields.firstName || fields.lastName)
    return {
      addFields: source.addFields !== false,
      collection: source.collection,
      defaultSubscribed: source.defaultSubscribed ?? false,
      fields: {
        name: hasSplitName ? fields.name : (fields.name ?? 'name'),
        email: fields.email ?? 'email',
        firstName: fields.firstName,
        lastName: fields.lastName,
        subscribed: fields.subscribed ?? 'subscribed',
      },
      label: source.label,
      properties: source.properties ?? {},
    }
  })

  const manage = options.access?.manage ?? isLoggedIn
  return {
    access: { manage, send: options.access?.send ?? manage },
    adminGroup: options.adminGroup ?? 'Newsletter',
    apiKey: options.apiKey ?? process.env.RESEND_API_KEY,
    deleteContacts: options.deleteContacts ?? true,
    disabled: options.disabled ?? false,
    editor: options.editor,
    media: options.media
      ? {
          allowPrivateUrls: options.media.allowPrivateUrls ?? false,
          baseUrl: options.media.baseUrl?.replace(/\/$/, ''),
          collection: options.media.collection,
        }
      : undefined,
    from: options.from,
    properties,
    replyTo: options.replyTo,
    resend: options.resend ?? {},
    slugs: { ...DEFAULT_SLUGS, ...(options.slugs ?? {}) },
    sources,
    syncMode: options.syncMode ?? 'await',
    templates: { default: DefaultTemplate, ...(options.templates ?? {}) },
    variables: options.variables,
    webhookSecret: options.webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET,
  }
}

function assertPropertyKey(collection: string, key: string) {
  if (!PROPERTY_KEY_PATTERN.test(key)) {
    throw new Error(
      `[plugin-resend-broadcasts] Property "${key}" on "${collection}": Resend keys are letters, digits and underscores, at most 50 characters.`,
    )
  }
  if (RESERVED_TOKENS.has(key) || key === FULL_NAME_PROPERTY) {
    throw new Error(
      `[plugin-resend-broadcasts] Property "${key}" on "${collection}" collides with a built-in variable (${[...RESERVED_TOKENS, FULL_NAME_PROPERTY].join(', ')}).`,
    )
  }
}
