import 'server-only'

import { createElement } from 'react'
import type { Payload } from 'payload'

import { ChangeEmailConfirmationEmail } from '@/components/auth/email/change-email-confirmation'
import { DeleteAccountVerificationEmail } from '@/components/auth/email/delete-account-verification'
import { EmailVerificationEmail } from '@/components/auth/email/email-verification'
import { MagicLinkEmail } from '@/components/auth/email/magic-link'
import { OrganizationInvitationEmail } from '@/components/auth/email/organization-invitation'
import { PasswordChangedEmail } from '@/components/auth/email/password-changed'
import { ResetPasswordEmail } from '@/components/auth/email/reset-password'
import stack from '@/stack.config'
import { emailDefaults, sendEmail } from './send'

const name = stack.name

export const emails = {
  verifyEmail: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, {
      to,
      subject: `Verify your email for ${name}`,
      react: createElement(EmailVerificationEmail, { ...emailDefaults, url, email: to }),
    }),

  magicLink: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, {
      to,
      subject: `Your sign-in link for ${name}`,
      react: createElement(MagicLinkEmail, { ...emailDefaults, url, email: to, expirationMinutes: 5 }),
    }),

  resetPassword: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, {
      to,
      subject: `Reset your ${name} password`,
      react: createElement(ResetPasswordEmail, { ...emailDefaults, url, email: to, expirationMinutes: 60 }),
    }),

  passwordChanged: (payload: Payload, to: string) =>
    sendEmail(payload, {
      to,
      subject: `Your ${name} password was changed`,
      react: createElement(PasswordChangedEmail, {
        ...emailDefaults,
        email: to,
        timestamp: new Date().toUTCString(),
        secureAccountURL: `${stack.url}/dashboard/settings/security`,
        supportEmail: stack.support.email,
      }),
    }),

  changeEmail: (payload: Payload, to: string, url: string, newEmail: string) =>
    sendEmail(payload, {
      to,
      subject: `Confirm your new email for ${name}`,
      react: createElement(ChangeEmailConfirmationEmail, {
        ...emailDefaults,
        url,
        currentEmail: to,
        newEmail,
        expirationMinutes: 60,
      }),
    }),

  deleteAccount: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, {
      to,
      subject: `Confirm deleting your ${name} account`,
      react: createElement(DeleteAccountVerificationEmail, { ...emailDefaults, url, email: to, expirationHours: 24 }),
    }),

  organizationInvitation: (
    payload: Payload,
    to: string,
    args: { url: string; inviterName?: string; inviterEmail?: string; organizationName: string; role?: string },
  ) =>
    sendEmail(payload, {
      to,
      subject: `${args.inviterName ?? args.inviterEmail ?? 'Someone'} invited you to ${args.organizationName} on ${name}`,
      react: createElement(OrganizationInvitationEmail, {
        ...emailDefaults,
        email: to,
        expirationHours: 48,
        ...args,
      }),
    }),

  adminInvite: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, {
      to,
      subject: `You have been invited to administer ${name}`,
      react: createElement(OrganizationInvitationEmail, {
        ...emailDefaults,
        url,
        email: to,
        organizationName: `${name} admin`,
        role: 'admin',
        expirationHours: 72,
      }),
    }),
}
