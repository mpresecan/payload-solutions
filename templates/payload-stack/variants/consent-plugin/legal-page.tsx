import { RichText, type JSXConverters } from '@payloadcms/richtext-lexical/react'
import { legalPageConverters } from '@payload-solutions/plugin-consent/rsc'
import { getConsentConfig, getProcessorTableData } from '@payload-solutions/plugin-consent/server'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { getPayloadClient } from '@/lib/payload'
import type { LegalPage } from '@/payload-types'

/**
 * The body of a legal page at /legal/[slug].
 *
 * Alongside the ordinary rich text, this renders the blocks an editor can drop into a document: the
 * cookie table, the recipients / sub-processor / annex tables, and the policy version line. They
 * are generated from the trackers and processors the project declares, so the published page cannot
 * drift from the configuration the way a hand-written table does.
 *
 * It is a function the route awaits rather than a component the route renders: the config has to be
 * read first, and an async component inside the returned tree cannot be rendered by anything but a
 * streaming renderer.
 */
export async function renderLegalPageContent(page: LegalPage, effectiveDate: string): Promise<ReactNode> {
  // Request first, then Payload: keeps `next build` from connecting to the database (see getSession).
  const requestHeaders = await headers()
  const payload = await getPayloadClient()
  const consent = await getConsentConfig(payload, { headers: requestHeaders })
  const processors = await getProcessorTableData(payload)

  return (
    <RichText
      converters={({ defaultConverters }) => ({
        ...defaultConverters,
        // The plugin types its converters structurally so it does not depend on
        // @payloadcms/richtext-lexical; its `table` converter takes a narrower node than
        // JSXConverters' index signature allows, so name the type it is used as here.
        ...(legalPageConverters({
          categories: consent.categories,
          trackers: consent.trackers,
          documentsVersion: consent.versions.documentsVersion,
          effectiveDate,
          ...processors,
        }) as unknown as JSXConverters),
      })}
      data={page.content}
    />
  )
}
