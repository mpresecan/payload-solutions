import { RichText } from '@payloadcms/richtext-lexical/react'

import type { LegalPage } from '@/payload-types'

/**
 * The body of a legal page at /legal/[slug].
 *
 * With Payload Consent this also renders the generated blocks an editor can drop into a document —
 * the cookie table, the recipients and sub-processor tables, the policy version line — so the
 * published page always reflects the trackers and processors the project actually declares.
 * Without it, a legal page is ordinary rich text.
 */
export function LegalPageContent({ page }: { page: LegalPage; effectiveDate: string }) {
  return <RichText data={page.content} />
}
