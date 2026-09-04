import { apiKeyClient } from '@better-auth/api-key/client'
import { passkeyClient } from '@better-auth/passkey/client'
import { stripeClient } from '@better-auth/stripe/client'
import {
  adminClient,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import stack from '@/stack.config'

/**
 * The Better Auth client for the browser. Plugins mirror the server plugins chosen in
 * stack.config.ts (see src/lib/auth/options.ts). Safe to import from client components.
 */
export const authClient = createAuthClient({
  baseURL: stack.url,
  plugins: [
    adminClient(),
    lastLoginMethodClient(),
    apiKeyClient(),
    twoFactorClient(),
    passkeyClient(),
    magicLinkClient(),
    organizationClient({ teams: { enabled: stack.features.teams } }),
    stripeClient({ subscription: true }),
  ],
})

export type AuthClient = typeof authClient
export type Session = AuthClient['$Infer']['Session']
