import type { DocumentViewServerProps } from 'payload'

import { Gutter } from '@payloadcms/ui'
import React from 'react'

import type { SampleFieldSpec } from '../types.js'

import { buildSampleFields } from '../render/sample-fields.js'
import { PreviewClient } from './PreviewClient.js'

/** "Preview & test" document tab. Renders inside Payload's document header; the panel is a client component. */
export const PreviewView = async (props: DocumentViewServerProps) => {
  const { doc, initPageResult } = props
  const { collectionConfig, req } = initPageResult
  const { config } = req.payload
  const id = doc?.id as number | string | undefined

  const locales = config.localization
    ? config.localization.locales.map((l) => ({ code: l.code, label: typeof l.label === 'string' ? l.label : l.code }))
    : []
  const hasDrafts = Boolean(collectionConfig?.versions?.drafts)

  const registry = (req.payload as unknown as { emails?: { definitions: Map<string, unknown> } }).emails
  const definition = doc?.key ? (registry?.definitions.get(doc.key) as { inputSchema?: never } | undefined) : undefined
  let sampleFields: SampleFieldSpec[] = []
  if (definition) {
    try {
      sampleFields = await buildSampleFields(req.payload, definition.inputSchema)
    } catch {
      sampleFields = []
    }
  }

  let testRecipient: string | undefined = (req.user as { email?: string } | null)?.email
  try {
    const settingsSlug = (config.globals ?? []).find((g) => g.admin?.group === 'Emails' && g.slug.endsWith('email-settings'))?.slug
    if (settingsSlug) {
      const settings = (await req.payload.findGlobal({ slug: settingsSlug as never, depth: 0, overrideAccess: true })) as {
        testRecipient?: string
      }
      testRecipient = settings.testRecipient || testRecipient
    }
  } catch {
    // ignore: fall back to the current user's email
  }

  if (!id || !collectionConfig) {
    return (
      <Gutter>
        <p>Save the email first to preview it.</p>
      </Gutter>
    )
  }

  // No Gutter: the split view is full-bleed, the way Payload's own live preview window is.
  return (
    <PreviewClient
      apiRoute={config.routes.api}
      collectionSlug={collectionConfig.slug}
      defaultLocale={config.localization ? config.localization.defaultLocale : undefined}
      hasDrafts={hasDrafts}
      id={String(id)}
      inUse={doc?.inUse !== false}
      locales={locales}
      sampleFields={sampleFields}
      sampleInput={(doc?.sampleInput as null | Record<string, unknown>) ?? null}
      serverURL={config.serverURL}
      testRecipient={testRecipient ?? ''}
    />
  )
}
