import 'server-only'

import { getPayload } from 'payload'
import type { BasePayload } from 'payload'
import type { BetterAuthReturn } from 'payload-auth/better-auth'

import config from '@payload-config'
import type { payloadAuthOptions } from '@/payload.config'

export type PayloadWithAuth = BasePayload & {
  betterAuth: BetterAuthReturn<typeof payloadAuthOptions>
}

/**
 * The Payload instance for server code. `getPayload` caches per process, so calling this in every
 * server component and route handler is cheap. `payload.betterAuth` is the Better Auth server
 * instance attached by payload-auth.
 */
export async function getPayloadClient(): Promise<PayloadWithAuth> {
  const payload = await getPayload({ config })
  return payload as PayloadWithAuth
}
