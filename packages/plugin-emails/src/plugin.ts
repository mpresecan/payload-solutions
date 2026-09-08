import type { Config, TaskConfig } from 'payload'

import { createEmailLogCollection } from './collections/email-log.js'
import { createTransactionalEmailsCollection } from './collections/transactional-emails.js'
import { sanitizeDefinition } from './define.js'
import { createEmailEditor } from './editor/features.js'
import { createPreviewEndpoint, createSendTestEndpoint } from './endpoints/preview.js'
import { createTemplatePreviewEndpoint, TEMPLATE_PREVIEW_PATH } from './endpoints/template-preview.js'
import { createEmailSettingsGlobal } from './globals/email-settings.js'
import { DefaultTemplate } from './render/template.js'
import { syncEmails } from './seed.js'
import { createEmailsAPI, SEND_TASK_SLUG } from './send.js'
import { createEmailsTypeScriptSchema } from './typescript/schema.js'
import type { EmailSlug, EmailsPluginOptions, SanitizedEmailDefinition, SanitizedEmailsPluginOptions, SendArgs } from './types.js'

export const PLUGIN_SLUG = 'plugin-emails'

export function sanitizeOptions(options: EmailsPluginOptions): SanitizedEmailsPluginOptions {
  const definitions = new Map<string, SanitizedEmailDefinition>()
  for (const raw of options.emails ?? []) {
    const definition = sanitizeDefinition(raw)
    if (definitions.has(definition.slug)) {
      throw new Error(`[plugin-emails] Duplicate email slug "${definition.slug}".`)
    }
    definitions.set(definition.slug, definition)
  }
  for (const definition of definitions.values()) {
    if (definition.template !== 'default' && !options.templates?.[definition.template]) {
      throw new Error(
        `[plugin-emails] "${definition.slug}" uses template "${definition.template}", which is not registered in plugin options.`,
      )
    }
  }
  const versions =
    options.versions === false
      ? false
      : options.versions === true || options.versions === undefined
        ? { drafts: true }
        : { drafts: Boolean(options.versions.drafts) }

  return {
    ...options,
    collectionSlug: options.collectionSlug ?? 'transactional-emails',
    definitions,
    templates: { default: DefaultTemplate, ...(options.templates ?? {}) },
    logSlug: options.log?.slug ?? 'email-log',
    settingsSlug: options.settings === false ? 'email-settings' : (options.settings?.slug ?? 'email-settings'),
    versions,
  }
}

export const emailsPlugin =
  (rawOptions: EmailsPluginOptions) =>
  (config: Config): Config => {
    const options = sanitizeOptions(rawOptions)
    const localized = Boolean(config.localization)
    options.editor = options.editor ?? createEmailEditor()

    config.collections = config.collections ?? []
    config.globals = config.globals ?? []

    const emails = createTransactionalEmailsCollection(options, { localized })
    emails.endpoints = [
      ...(Array.isArray(emails.endpoints) ? emails.endpoints : []),
      createPreviewEndpoint(options),
      createSendTestEndpoint(options),
    ]
    config.collections.push(emails)

    if (options.log?.enabled) {
      config.collections.push(createEmailLogCollection(options))
    }
    if (options.settings !== false) {
      config.globals.push(createEmailSettingsGlobal(options, { localized }))
    }

    config.endpoints = [...(config.endpoints ?? []), createTemplatePreviewEndpoint(options)]

    config.typescript = config.typescript ?? {}
    config.typescript.schema = [...(config.typescript.schema ?? []), createEmailsTypeScriptSchema(options)]

    if (options.queue?.enabled) {
      const task: TaskConfig<any> = {
        slug: SEND_TASK_SLUG,
        handler: async ({ input, req }) => {
          const { args, slug } = input as { args: SendArgs<any>; slug: string }
          const result = await req.payload.emails.send(slug as EmailSlug, { ...args, queue: false, req })
          if (result.status === 'failed') {
            throw new Error(result.error ?? 'Email delivery failed')
          }
          return { output: { result } }
        },
        inputSchema: [
          { name: 'slug', type: 'text', required: true },
          { name: 'args', type: 'json', required: true },
        ],
        label: 'Send transactional email',
        outputSchema: [{ name: 'result', type: 'json' }],
        retries: options.queue.retries ?? 3,
      }
      config.jobs = config.jobs ?? { tasks: [] }
      config.jobs.tasks = [...(config.jobs.tasks ?? []), task]
    }

    // Keep schema additions even when disabled so migrations stay consistent.
    if (options.disabled) {
      return config
    }

    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      // Attach the API and seed documents first so the host's own onInit (and any hooks it triggers)
      // can already call payload.emails.send().
      payload.emails = createEmailsAPI(payload, options)

      const seed = options.seed ?? 'always'
      if (seed === 'always' || (seed === 'development' && process.env.NODE_ENV !== 'production')) {
        try {
          const result = await syncEmails(payload, options)
          const changes = result.created.length + result.refreshed.length + result.orphaned.length + result.renamed.length
          if (changes) {
            payload.logger.info(
              `[plugin-emails] synced: ${result.created.length} created, ${result.refreshed.length} refreshed, ${result.renamed.length} renamed, ${result.orphaned.length} orphaned`,
            )
          }
        } catch (error) {
          payload.logger.error({ err: error, msg: '[plugin-emails] Seeding transactional emails failed' })
        }
      }

      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
    }

    return config
  }
