import type { CollectionSlug, Payload } from 'payload'

import { codeOwnedFields, definitionHash } from './define.js'
import { isSerializedEditorState, markdownToLexical } from './render/markdown.js'
import { pickLocalized } from './render/render.js'
import type { SanitizedEmailDefinition, SanitizedEmailsPluginOptions, SyncResult, TransactionalEmailDoc } from './types.js'

type Locales = { all: string[]; default: string }

function getLocales(payload: Payload): Locales | null {
  const { localization } = payload.config
  if (!localization) {
    return null
  }
  return { all: localization.localeCodes, default: localization.defaultLocale }
}

function localesIn(value: unknown): string[] {
  return value && typeof value === 'object' && !('root' in (value as object)) ? Object.keys(value as object) : []
}

async function copyFor(payload: Payload, definition: SanitizedEmailDefinition, locale?: string) {
  const { defaults } = definition
  const body = isSerializedEditorState(defaults.body)
    ? defaults.body
    : await markdownToLexical(payload.config, pickLocalized(defaults.body, locale))
  return {
    body,
    preheader: pickLocalized(defaults.preheader, locale) || null,
    subject: pickLocalized(defaults.subject, locale),
  }
}

/** Seed missing documents, refresh code-owned metadata, rename by `previousSlugs`, flag orphans. Idempotent. */
export async function syncEmails(payload: Payload, options: SanitizedEmailsPluginOptions): Promise<SyncResult> {
  const result: SyncResult = { created: [], orphaned: [], refreshed: [], renamed: [] }
  const collection = options.collectionSlug as never
  const locales = getLocales(payload)
  const drafts = options.versions && options.versions.drafts

  // Raw rows: the collection's afterRead hook overlays code-owned fields from the registry, which
  // would hide the stored definitionHash / inUse values this routine compares against.
  const { docs } = await payload.db.find({
    collection: options.collectionSlug as CollectionSlug,
    limit: 0,
    pagination: false,
  })
  const existing = new Map<string, TransactionalEmailDoc>()
  for (const doc of docs as TransactionalEmailDoc[]) {
    existing.set(doc.key, doc)
  }

  const refresh = async (doc: TransactionalEmailDoc, definition: SanitizedEmailDefinition, extra: Record<string, unknown> = {}) => {
    await payload.db.updateOne({
      id: doc.id,
      collection: options.collectionSlug as CollectionSlug,
      data: { ...codeOwnedFields(definition), ...extra, updatedAt: new Date().toISOString() },
    })
  }

  for (const definition of options.definitions.values()) {
    let doc = existing.get(definition.slug)

    if (!doc) {
      const previous = (definition.previousSlugs ?? []).map((s) => existing.get(s)).find(Boolean)
      if (previous) {
        await refresh(previous, definition, { key: definition.slug })
        existing.delete(previous.key)
        existing.set(definition.slug, { ...previous, key: definition.slug })
        result.renamed.push({ from: previous.key, to: definition.slug })
        continue
      }
    }

    if (!doc) {
      try {
        const created = (await payload.create({
          collection,
          data: {
            ...codeOwnedFields(definition),
            ...(await copyFor(payload, definition, locales?.default)),
            enabled: true,
            key: definition.slug,
            ...(drafts ? { _status: 'published' } : {}),
          } as never,
          depth: 0,
          draft: false,
          locale: (locales?.default ?? undefined) as never,
          overrideAccess: true,
        })) as TransactionalEmailDoc
        doc = created
        existing.set(definition.slug, created)
        result.created.push(definition.slug)

        if (locales) {
          const extra = new Set([
            ...localesIn(definition.defaults.subject),
            ...localesIn(definition.defaults.preheader),
            ...localesIn(definition.defaults.body),
          ])
          extra.delete(locales.default)
          for (const locale of extra) {
            if (!locales.all.includes(locale)) {
              continue
            }
            await payload.update({
              id: created.id,
              collection,
              data: (await copyFor(payload, definition, locale)) as never,
              depth: 0,
              draft: false,
              locale: locale as never,
              overrideAccess: true,
            })
          }
        }
      } catch (error) {
        // Two instances seeding at once: the unique key rejects the second create. Not an error.
        payload.logger.warn({ err: error, msg: `[plugin-emails] Could not seed "${definition.slug}" (already exists?)` })
      }
      continue
    }

    if (doc.definitionHash !== definitionHash(definition) || doc.inUse === false) {
      await refresh(doc, definition)
      result.refreshed.push(definition.slug)
    }
  }

  for (const [key, doc] of existing) {
    if (!options.definitions.has(key) && doc.inUse !== false) {
      await payload.db.updateOne({
        id: doc.id,
        collection: options.collectionSlug as CollectionSlug,
        data: { inUse: false, updatedAt: new Date().toISOString() },
      })
      result.orphaned.push(key)
    }
  }

  if (options.settings !== false && options.settings?.adminRecipients?.length) {
    const settings = (await payload.findGlobal({
      slug: options.settingsSlug as never,
      depth: 0,
      overrideAccess: true,
    })) as { adminRecipients?: unknown[] }
    if (!settings.adminRecipients?.length) {
      await payload.updateGlobal({
        slug: options.settingsSlug as never,
        data: { adminRecipients: options.settings.adminRecipients.map((email) => ({ email })) } as never,
        overrideAccess: true,
      })
    }
  }

  return result
}
