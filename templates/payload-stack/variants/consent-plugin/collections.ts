import type { CollectionConfig } from 'payload'

/**
 * Empty on purpose: with Payload Consent the plugin registers the `legal-pages` collection itself,
 * with drafts, an effective-date history, a document kind and a Lexical editor that can embed the
 * generated cookie and sub-processor tables. Editing them is the same job it was; the fields are
 * richer and the tables stay true.
 */
export const legalCollections: CollectionConfig[] = []
