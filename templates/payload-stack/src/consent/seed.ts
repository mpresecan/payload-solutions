import type { Payload } from 'payload'

import { seedLegalPages } from '@/seed/legal'

/**
 * Seeds starter legal pages on first boot, into an empty collection only.
 *
 * With Payload Consent this is a no-op: the plugin seeds its own documents from the company
 * details in stack.config.ts, and `payload-consent scan` then tells you what is still a placeholder.
 */
export async function seedLegal(payload: Payload) {
  await seedLegalPages(payload)
}
