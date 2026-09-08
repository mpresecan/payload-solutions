import type { Payload } from 'payload'

/**
 * Nothing to do: the plugin seeds the categories, the processor rows and the legal pages on first
 * boot, into empty collections only, from the company details in stack.config.ts
 * (src/consent/plugin.ts).
 */
export async function seedLegal(_payload: Payload) {}
