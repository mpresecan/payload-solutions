import { RichText } from '@payloadcms/richtext-lexical/react'
import { legalPageConverters } from '@payload-solutions/plugin-consent/rsc'
import { getConsentConfig, getProcessorTableData } from '@payload-solutions/plugin-consent/server'
import { headers } from 'next/headers'

import type { LegalPage } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'

/**
 * The body of a legal page at /legal/[slug].
 *
 * Alongside the ordinary rich text, this renders the blocks an editor can drop into a document: the
 * cookie table, the recipients / sub-processor / annex tables, and the policy version line. They
 * are generated from the trackers and processors the project declares, so the published page cannot
 * drift from the configuration the way a hand-written table does.
 */
export async function LegalPageContent({ page, effectiveDate }: { page: LegalPage; effectiveDate: string }) {
  const payload = await getPayloadClient()
  const consent = await getConsentConfig(payload, { headers: await headers() })
  const processors = await getProcessorTableData(payload)

  return (
    <RichText
      converters={({ defaultConverters }) => ({
        ...defaultConverters,
        ...legalPageConverters({
          categories: consent.categories,
          trackers: consent.trackers,
          documentsVersion: consent.versions.documentsVersion,
          effectiveDate,
          ...processors,
        }),
      })}
      data={page.content}
    />
  )
}
