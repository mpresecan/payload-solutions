import { RichText } from '@payloadcms/richtext-lexical/react'
import type { ReactNode } from 'react'

import type { LegalPage } from '@/payload-types'

/**
 * The body of a legal page at /legal/[slug].
 *
 * With Payload Consent this also renders the generated blocks an editor can drop into a document —
 * the cookie table, the recipients and sub-processor tables, the policy version line — so the
 * published page always reflects the trackers and processors the project actually declares.
 * Without it, a legal page is ordinary rich text.
 *
 * It is a function the route awaits rather than a component the route renders, because the plugged
 * branch has to read the consent config first, and an async component inside the returned tree
 * cannot be rendered by anything but a streaming renderer.
 */
export async function renderLegalPageContent(page: LegalPage, _effectiveDate: string): Promise<ReactNode> {
  return <RichText data={page.content} />
}
