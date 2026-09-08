import type { EmailDefinition } from '@payload-solutions/plugin-emails'

import stack from '@/stack.config'

import * as account from './account'
import * as auth from './auth'
import * as billing from './billing'
import * as organization from './organization'

/**
 * The catalogue, filtered by what this product actually has.
 *
 * A definition that is not in this array is not in the admin, not in the generated types and never
 * sent — so turning off organizations in stack.config.ts removes five emails from the editor's list
 * rather than leaving five dead entries behind. Documents for removed emails are not deleted: the
 * plugin flags them as no longer in use, so nothing is lost if the feature comes back.
 *
 * Adding your own: write a `defineEmail` object next to these, add it here, and run
 * `pnpm generate:types` to type its `input` at every call site.
 */
export const emailDefinitions: EmailDefinition<any>[] = [
  // Auth — Better Auth triggers these itself.
  auth.emailVerification,
  ...(stack.features.magicLink ? [auth.magicLink] : []),
  ...(stack.features.emailPassword ? [auth.passwordReset, auth.passwordChanged] : []),
  ...(stack.features.twoFactor ? [auth.twoFactorCode] : []),
  auth.adminInvite,

  // Account lifecycle.
  account.welcome,
  account.emailChangeConfirmation,
  account.emailChanged,
  account.accountDeletionConfirmation,
  account.accountDeleted,

  // Organizations.
  ...(stack.features.organizations
    ? [
        organization.organizationInvitation,
        organization.organizationMemberJoined,
        organization.organizationInvitationAccepted,
        organization.organizationRoleChanged,
        organization.organizationMemberRemoved,
      ]
    : []),

  // Billing.
  ...(stack.features.billing
    ? [
        billing.subscriptionStarted,
        billing.subscriptionUpdated,
        billing.subscriptionCanceled,
        billing.subscriptionEnded,
        billing.trialEnding,
        billing.trialExpired,
        billing.paymentSucceeded,
        billing.paymentFailed,
      ]
    : []),
]
