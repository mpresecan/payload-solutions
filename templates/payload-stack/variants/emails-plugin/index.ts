import 'server-only'

import type { Payload } from 'payload'

/**
 * Every transactional email the app sends, in one object.
 *
 * The signatures are the seam: Better Auth's callbacks (src/lib/auth/options.ts) and payload-auth's
 * admin invitations call these functions and know nothing about how a message is built. Here they
 * are routed through Payload Emails, so subject, preheader and body live in the Payload admin under
 * **Emails** and marketing can change the words without a deploy. The design lives in code
 * (src/emails/template.tsx) and the variables each message may use live in its definition
 * (src/emails/definitions).
 *
 * Notices that fire from webhooks and membership changes are wired up in src/emails/hooks.ts.
 *
 * `payload.emails.send` is typed: run `pnpm generate:types` and the editor will check the `input`
 * of every call below against the definition's `inputSchema`.
 */

const sendEmail = (payload: Payload, slug: string, input: Record<string, unknown>, to: string) =>
  payload.emails.send(slug as never, { input: input as never, to })

export const emails = {
  verifyEmail: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, 'email-verification', { email: to, expiresIn: 60, url }, to),

  magicLink: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, 'magic-link', { email: to, expiresIn: 5, url }, to),

  resetPassword: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, 'password-reset', { email: to, expiresIn: 60, url }, to),

  passwordChanged: (payload: Payload, to: string) =>
    sendEmail(payload, 'password-changed', { changedAt: new Date().toISOString(), email: to }, to),

  changeEmail: (payload: Payload, to: string, url: string, newEmail: string) =>
    sendEmail(payload, 'email-change-confirmation', { currentEmail: to, expiresIn: 60, newEmail, url }, to),

  deleteAccount: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, 'account-deletion-confirmation', { email: to, expiresIn: 24, url }, to),

  organizationInvitation: (
    payload: Payload,
    to: string,
    args: { inviterEmail?: string; inviterName?: string; organizationName: string; role?: string; url: string },
  ) => sendEmail(payload, 'organization-invitation', { email: to, expiresIn: 48, ...args }, to),

  adminInvite: (payload: Payload, to: string, url: string) =>
    sendEmail(payload, 'admin-invite', { email: to, expiresIn: 72, url }, to),
}
