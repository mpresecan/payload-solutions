/**
 * Better Auth server options, derived from stack.config.ts.
 *
 * payload-auth takes these options, gives Better Auth a database adapter backed by Payload's
 * local API, generates the users / sessions / accounts / organizations / subscriptions collections,
 * and makes the Payload admin trust the same session. See src/payload.config.ts.
 *
 * Callbacks that send email resolve Payload lazily (dynamic import) to avoid an import cycle with
 * payload.config.ts.
 */
import { apiKey } from '@better-auth/api-key'
import { passkey } from '@better-auth/passkey'
import { stripe } from '@better-auth/stripe'
import type { BetterAuthPlugin } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { admin, lastLoginMethod, magicLink, organization, twoFactor } from 'better-auth/plugins'
import Stripe from 'stripe'

import type { BetterAuthOptions } from 'payload-auth/better-auth'
import { env } from '@/lib/env'
import { toStripePlans } from '@/lib/stack'
import stack from '@/stack.config'

async function payloadClient() {
  const { getPayloadClient } = await import('@/lib/payload')
  return getPayloadClient()
}

async function mail() {
  const { emails } = await import('@/emails')
  return emails
}

export const ROLES = ['user', 'admin'] as const
export const ADMIN_ROLES = ['admin'] as const

function socialProviders(): NonNullable<BetterAuthOptions['socialProviders']> {
  const providers: NonNullable<BetterAuthOptions['socialProviders']> = {}
  const pairs: Record<(typeof stack.auth.social)[number], [string | undefined, string | undefined]> = {
    google: [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
    github: [env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET],
    microsoft: [env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET],
    apple: [env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET],
    discord: [env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET],
  }
  for (const provider of stack.auth.social) {
    const [clientId, clientSecret] = pairs[provider]
    if (!clientId || !clientSecret) {
      throw new Error(
        `stack.config.ts lists "${provider}" under auth.social but ${provider.toUpperCase()}_CLIENT_ID / _CLIENT_SECRET are not set.`,
      )
    }
    ;(providers as Record<string, unknown>)[provider] = { clientId, clientSecret }
  }
  return providers
}

function plugins(): BetterAuthPlugin[] {
  const list: BetterAuthPlugin[] = [
    // Roles, bans and impersonation. payload-auth forwards users.roles / adminRoles to it.
    admin(),
    lastLoginMethod(),
    apiKey(),
  ]

  if (stack.features.twoFactor) {
    list.push(twoFactor({ issuer: stack.name }))
  }

  if (stack.features.passkeys) {
    list.push(
      passkey({
        rpName: stack.name,
        rpID: new URL(stack.url).hostname,
        origin: stack.url,
      }),
    )
  }

  if (stack.features.magicLink) {
    list.push(
      magicLink({
        expiresIn: 60 * 5,
        sendMagicLink: async ({ email, url }) => {
          const payload = await payloadClient()
          await (await mail()).magicLink(payload, email, url)
        },
      }),
    )
  }

  if (stack.features.organizations) {
    list.push(
      organization({
        allowUserToCreateOrganization: stack.organizations.allowUserToCreate,
        creatorRole: stack.organizations.creatorRole,
        teams: stack.features.teams ? { enabled: true } : undefined,
        invitationExpiresIn: 60 * 60 * 48,
        cancelPendingInvitationsOnReInvite: true,
        sendInvitationEmail: async (data) => {
          const payload = await payloadClient()
          await (await mail()).organizationInvitation(payload, data.email, {
            url: `${stack.url}/auth/accept-invitation?invitationId=${data.id}`,
            inviterName: data.inviter.user.name,
            inviterEmail: data.inviter.user.email,
            organizationName: data.organization.name,
            role: data.role,
          })
        },
      }),
    )
  }

  if (stack.billing.provider === 'stripe') {
    const secretKey = env.STRIPE_SECRET_KEY
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET
    if (secretKey && webhookSecret) {
      const stripeClient = new Stripe(secretKey)
      list.push(
        stripe({
          stripeClient,
          stripeWebhookSecret: webhookSecret,
          createCustomerOnSignUp: stack.billing.attachedTo === 'user',
          subscription: {
            enabled: true,
            plans: toStripePlans(stack),
            requireEmailVerification: stack.auth.requireEmailVerification,
            // Only owners and admins of an organization may manage its subscription.
            authorizeReference: async ({ user, referenceId, session }) => {
              if (referenceId === user.id) return true
              const payload = await payloadClient()
              const { toPayloadId } = await import('@/lib/ids')
              const members = await payload.find({
                collection: 'members',
                where: {
                  and: [
                    { user: { equals: toPayloadId(payload, user.id) } },
                    { organization: { equals: toPayloadId(payload, referenceId) } },
                  ],
                },
                depth: 0,
                limit: 1,
                overrideAccess: true,
              })
              const role = members.docs[0]?.role
              void session
              return role === 'owner' || role === 'admin'
            },
          },
          organization: stack.billing.attachedTo === 'organization' ? { enabled: true } : undefined,
        }),
      )
    } else {
      // Builds and previews without Stripe keys still work: the pricing page renders from config and
      // the checkout / billing UI is hidden (see Providers `billingReady`).
      console.warn(
        '[payload-stack] stack.config.ts enables Stripe billing but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set. Billing is disabled for this run.',
      )
    }
  }

  // Must be last so Set-Cookie from server actions is written. See payload-auth docs.
  list.push(nextCookies())
  return list
}

export const betterAuthOptions: BetterAuthOptions = {
  appName: stack.name,
  baseURL: stack.url,
  secret: env.BETTER_AUTH_SECRET ?? env.PAYLOAD_SECRET,
  trustedOrigins: [stack.url],

  emailAndPassword: {
    enabled: stack.features.emailPassword,
    requireEmailVerification: stack.auth.requireEmailVerification,
    disableSignUp: !stack.auth.allowSignUp,
    sendResetPassword: async ({ user, url }) => {
      const payload = await payloadClient()
      await (await mail()).resetPassword(payload, user.email, url)
    },
    onPasswordReset: async ({ user }) => {
      const payload = await payloadClient()
      await (await mail()).passwordChanged(payload, user.email)
    },
  },

  emailVerification: {
    sendOnSignUp: stack.auth.requireEmailVerification,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const payload = await payloadClient()
      await (await mail()).verifyEmail(payload, user.email, url)
    },
  },

  socialProviders: socialProviders(),

  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        const payload = await payloadClient()
        await (await mail()).changeEmail(payload, user.email, url, newEmail)
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        const payload = await payloadClient()
        await (await mail()).deleteAccount(payload, user.email, url)
      },
    },
  },

  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  plugins: plugins(),
}
