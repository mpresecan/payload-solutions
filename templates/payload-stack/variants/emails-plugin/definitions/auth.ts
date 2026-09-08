import { defineEmail } from '@payload-solutions/plugin-emails'

import { as, linkInput, linkVariables, resolveLink, str } from './shared'

/**
 * Sign-in and identity emails: the ones Better Auth triggers on its own.
 *
 * Every definition names the call site in `trigger`, so an editor reading the admin knows what
 * makes the message go out, and a developer knows where to look.
 */

export const emailVerification = defineEmail({
  slug: 'email-verification',
  label: 'Verify email address',
  description: 'Confirms that a new address belongs to the person signing up.',
  trigger: 'Better Auth emailVerification.sendVerificationEmail',
  group: 'Auth',
  audience: 'user',
  required: true,
  inputSchema: linkInput({ expiresIn: 60 }),
  variables: linkVariables({ expires: 60, url: 'https://example.com/auth/verify-email?token=…' }),
  resolve: ({ input }) => resolveLink(input, 60),
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Verify your email address for {{site.name}}',
    preheader: 'One click and your account is ready.',
    body: `
Confirm that **{{email}}** is your address and your {{site.name}} account is ready to use.

<Button label="Verify email address" url="{{url}}" />

The link is valid for {{expires.in}} minutes. If you did not create an account, you can ignore this message — nothing happens until the link is used.
`,
  },
  sample: { email: 'ada@example.com', expiresIn: 60, url: 'https://example.com/auth/verify-email?token=sample' },
})

export const magicLink = defineEmail({
  slug: 'magic-link',
  label: 'Sign-in link',
  description: 'A single-use link that signs the person in without a password.',
  trigger: 'Better Auth magicLink.sendMagicLink',
  group: 'Auth',
  audience: 'user',
  required: true,
  inputSchema: linkInput({ expiresIn: 5 }),
  variables: linkVariables({ expires: 5, url: 'https://example.com/auth/magic-link?token=…' }),
  resolve: ({ input }) => resolveLink(input, 5),
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Your sign-in link for {{site.name}}',
    preheader: 'Valid for {{expires.in}} minutes.',
    body: `
Use the link below to sign in as **{{email}}**.

<Button label="Sign in to {{site.name}}" url="{{url}}" />

It works once and expires in {{expires.in}} minutes. If you did not ask to sign in, ignore this message and your account stays as it is.
`,
  },
  sample: { email: 'ada@example.com', expiresIn: 5, url: 'https://example.com/auth/magic-link?token=sample' },
})

export const passwordReset = defineEmail({
  slug: 'password-reset',
  label: 'Reset password',
  description: 'Sent when someone asks to set a new password.',
  trigger: 'Better Auth emailAndPassword.sendResetPassword',
  group: 'Auth',
  audience: 'user',
  required: true,
  inputSchema: linkInput({ expiresIn: 60 }),
  variables: linkVariables({ expires: 60, url: 'https://example.com/auth/reset-password?token=…' }),
  resolve: ({ input }) => resolveLink(input, 60),
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Reset your {{site.name}} password',
    preheader: 'Choose a new password.',
    body: `
Someone asked to reset the password for **{{email}}**.

<Button label="Choose a new password" url="{{url}}" />

The link expires in {{expires.in}} minutes. If this was not you, ignore this message — your current password keeps working and nothing changes.
`,
  },
  sample: { email: 'ada@example.com', expiresIn: 60, url: 'https://example.com/auth/reset-password?token=sample' },
})

export const passwordChanged = defineEmail({
  slug: 'password-changed',
  label: 'Password changed',
  description: 'Security notice sent after a password is set or changed.',
  trigger: 'Better Auth emailAndPassword.onPasswordReset',
  group: 'Auth',
  audience: 'user',
  required: true,
  inputSchema: [
    { name: 'email', type: 'email', required: true },
    { name: 'changedAt', type: 'date', required: true },
  ],
  variables: {
    email: { description: 'The account the password belongs to', example: 'ada@example.com' },
    changedAt: { description: 'When it changed', example: '2026-09-08T10:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { changedAt, email } = as<{ changedAt: string; email: string }>(input)
    return { changedAt, email }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Your {{site.name}} password was changed',
    preheader: 'If this was not you, act now.',
    body: `
The password for **{{email}}** was changed on {{changedAt}}.

If you made this change, there is nothing to do.

If you did not, secure the account now: reset the password and review the devices signed in to it.

<Button label="Review account security" url="{{url.security}}" fallback="false" />

Still worried? Reply to this email or write to [{{support.email}}](mailto:{{support.email}}).
`,
  },
  sample: { changedAt: new Date().toISOString(), email: 'ada@example.com' },
})

export const twoFactorCode = defineEmail({
  slug: 'two-factor-code',
  label: 'Two-factor code',
  description: 'The one-time code used as a second factor at sign-in.',
  trigger: 'Better Auth twoFactor.otpOptions.sendOTP',
  group: 'Auth',
  audience: 'user',
  required: true,
  inputSchema: [
    { name: 'email', type: 'email', required: true },
    { name: 'code', type: 'text', required: true },
    { name: 'expiresIn', type: 'number', defaultValue: 3, admin: { description: 'Validity in minutes' } },
  ],
  variables: {
    email: { example: 'ada@example.com' },
    code: { description: 'The one-time code', example: '481920' },
    'expires.in': { description: 'Validity in minutes', example: 3, type: 'number' },
  },
  resolve: ({ input }) => {
    const { code, email, expiresIn } = as<{ code: string; email: string; expiresIn?: number }>(input)
    return { code, email, 'expires.in': expiresIn ?? 3 }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Your {{site.name}} sign-in code',
    preheader: 'Code: {{code}}',
    body: `
Enter this code to finish signing in:

## {{code}}

It expires in {{expires.in}} minutes and can be used once.

If you did not try to sign in, someone else has your password. Change it now at [{{site.name}}]({{url.security}}).
`,
  },
  sample: { code: '481920', email: 'ada@example.com', expiresIn: 3 },
})

export const adminInvite = defineEmail({
  slug: 'admin-invite',
  label: 'Admin panel invitation',
  description: 'Invites someone to administer the Payload admin panel.',
  trigger: 'payload-auth adminInvitations.sendInviteEmail',
  group: 'Auth',
  audience: 'user',
  inputSchema: [
    { name: 'email', type: 'email', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'expiresIn', type: 'number', defaultValue: 72, admin: { description: 'Validity in hours' } },
  ],
  variables: {
    email: { example: 'ada@example.com' },
    url: { description: 'Invitation link', example: 'https://example.com/admin/create-first-user', type: 'url' },
    'expires.hours': { description: 'Validity in hours', example: 72, type: 'number' },
  },
  resolve: ({ input }) => {
    const { email, expiresIn, url } = as<{ email: string; expiresIn?: number; url: string }>(input)
    return { email, url, 'expires.hours': expiresIn ?? 72 }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'You have been invited to administer {{site.name}}',
    preheader: 'Set up your admin account.',
    body: `
You have been given access to the {{site.name}} admin panel, where content, users and settings are managed.

<Button label="Set up your admin account" url="{{url}}" />

The invitation expires in {{expires.hours}} hours. If you were not expecting it, ignore this message.
`,
  },
  sample: { email: 'ada@example.com', expiresIn: 72, url: 'https://example.com/admin' },
})
