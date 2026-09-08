import type { CollectionConfig } from 'payload'

import { LegalPages } from '@/collections/LegalPages'

/**
 * Legal pages as a plain collection (src/collections/LegalPages.ts).
 *
 * With Payload Consent the plugin owns the same `legal-pages` slug — drafts, an effective-date
 * history, a document kind, and a Lexical editor that can embed the generated cookie and
 * sub-processor tables — and this array is empty.
 */
export const legalCollections: CollectionConfig[] = [LegalPages]
