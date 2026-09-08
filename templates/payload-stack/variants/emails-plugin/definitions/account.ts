import { defineEmail, populate } from '@payload-solutions/plugin-emails'

import { as, str } from './shared'

/**
 * Account lifecycle: the first message a new user gets, and every notice about the identity behind
 * the account changing hands. These fire from application code (a Users hook, Better Auth's
 * change-email and delete-account flows) rather than from a sign-in attempt.
 */

type UserDoc = { email: string; id: number | string; name?: null | string }

export const welcome = defineEmail({
  slug: 'welcome',
  label: 'Welcome',
  description: 'The first email a new account receives.',
  trigger: 'users afterChange hook (operation: create)',
  group: 'Account',
  audience: 'user',
  inputSchema: [{ name: 'user', type: 'relationship', relationTo: 'users', required: true }],
  variables: {
    'user.name': { description: 'Display name, falling back to the address', example: 'Ada Lovelace' },
    'user.email': { example: 'ada@example.com' },
  },
  resolve: async ({ input, payload, req }) => {
    const { user } = as<{ user: number | string }>(input)
    const doc = await populate<UserDoc>(payload, 'users', user, { req })
    return { 'user.email': doc.email, 'user.name': doc.name || doc.email }
  },
  to: ({ variables }) => str(variables['user.email']),
  defaults: {
    subject: 'Welcome to {{site.name}}',
    preheader: 'Your account is ready.',
    body: `
Hi {{user.name}},

Your {{site.name}} account is ready. {{site.tagline}}

<Button label="Open your dashboard" url="{{url.dashboard}}" fallback="false" />

You are signed up as **{{user.email}}**. Account settings, security and sign-in methods all live under [your account]({{url.account}}).

Questions go to [{{support.email}}](mailto:{{support.email}}) — a real person reads them.
`,
  },
  sample: async ({ payload }) => ({
    user: (await payload.find({ collection: 'users', depth: 0, limit: 1 })).docs[0]?.id ?? '',
  }),
})

export const emailChangeConfirmation = defineEmail({
  slug: 'email-change-confirmation',
  label: 'Confirm new email address',
  description: 'Asks the current address to approve a change to a new one.',
  trigger: 'Better Auth user.changeEmail.sendChangeEmailConfirmation',
  group: 'Account',
  audience: 'user',
  required: true,
  inputSchema: [
    { name: 'currentEmail', type: 'email', required: true },
    { name: 'newEmail', type: 'email', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'expiresIn', type: 'number', defaultValue: 60, admin: { description: 'Validity in minutes' } },
  ],
  variables: {
    'email.current': { description: 'Address on the account today', example: 'ada@example.com' },
    'email.new': { description: 'Address being moved to', example: 'ada@newdomain.com' },
    url: { description: 'Confirmation link', example: 'https://example.com/auth/change-email?token=…', type: 'url' },
    'expires.in': { description: 'Validity in minutes', example: 60, type: 'number' },
  },
  resolve: ({ input }) => {
    const { currentEmail, expiresIn, newEmail, url } = as<{
      currentEmail: string
      expiresIn?: number
      newEmail: string
      url: string
    }>(input)
    return { 'email.current': currentEmail, 'email.new': newEmail, 'expires.in': expiresIn ?? 60, url }
  },
  to: ({ variables }) => str(variables['email.current']),
  defaults: {
    subject: 'Confirm your new email address for {{site.name}}',
    preheader: 'Approve the change from this address.',
    body: `
Someone asked to move this {{site.name}} account from **{{email.current}}** to **{{email.new}}**.

Approving this means sign-in links, password resets and every future notice go to the new address.

<Button label="Confirm the change" url="{{url}}" />

The link expires in {{expires.in}} minutes. If you did not ask for this, do not use it — and change your password, because someone else may have access to the account.
`,
  },
  sample: {
    currentEmail: 'ada@example.com',
    expiresIn: 60,
    newEmail: 'ada@newdomain.com',
    url: 'https://example.com/auth/change-email?token=sample',
  },
})

export const emailChanged = defineEmail({
  slug: 'email-changed',
  label: 'Email address changed',
  description: 'Tells the old address that it no longer receives account mail.',
  trigger: 'users afterChange hook (email differs from the previous document)',
  group: 'Account',
  audience: 'user',
  inputSchema: [
    { name: 'previousEmail', type: 'email', required: true },
    { name: 'newEmail', type: 'email', required: true },
    { name: 'changedAt', type: 'date', required: true },
  ],
  variables: {
    'email.previous': { description: 'Address that was replaced', example: 'ada@example.com' },
    'email.new': { description: 'Address now on the account', example: 'ada@newdomain.com' },
    changedAt: { description: 'When it changed', example: '2026-09-08T10:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { changedAt, newEmail, previousEmail } = as<{
      changedAt: string
      newEmail: string
      previousEmail: string
    }>(input)
    return { changedAt, 'email.new': newEmail, 'email.previous': previousEmail }
  },
  to: ({ variables }) => str(variables['email.previous']),
  defaults: {
    subject: 'The email address on your {{site.name}} account changed',
    preheader: 'This address will no longer receive account mail.',
    body: `
On {{changedAt}} the address on this {{site.name}} account changed from **{{email.previous}}** to **{{email.new}}**.

This is the last message {{email.previous}} will receive about the account.

If you did not make this change, contact [{{support.email}}](mailto:{{support.email}}) straight away — the account may no longer be under your control.
`,
  },
  sample: {
    changedAt: new Date().toISOString(),
    newEmail: 'ada@newdomain.com',
    previousEmail: 'ada@example.com',
  },
})

export const accountDeletionConfirmation = defineEmail({
  slug: 'account-deletion-confirmation',
  label: 'Confirm account deletion',
  description: 'Asks for confirmation before an account is deleted for good.',
  trigger: 'Better Auth user.deleteUser.sendDeleteAccountVerification',
  group: 'Account',
  audience: 'user',
  required: true,
  inputSchema: [
    { name: 'email', type: 'email', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'expiresIn', type: 'number', defaultValue: 24, admin: { description: 'Validity in hours' } },
  ],
  variables: {
    email: { example: 'ada@example.com' },
    url: { description: 'Confirmation link', example: 'https://example.com/auth/delete-account?token=…', type: 'url' },
    'expires.hours': { description: 'Validity in hours', example: 24, type: 'number' },
  },
  resolve: ({ input }) => {
    const { email, expiresIn, url } = as<{ email: string; expiresIn?: number; url: string }>(input)
    return { email, url, 'expires.hours': expiresIn ?? 24 }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Confirm you want to delete your {{site.name}} account',
    preheader: 'This cannot be undone.',
    body: `
You asked to delete the {{site.name}} account for **{{email}}**.

Confirming removes your account and the data attached to it. It cannot be undone.

<Button label="Delete my account" url="{{url}}" />

The link expires in {{expires.hours}} hours. Change your mind by doing nothing — the account stays exactly as it is.
`,
  },
  sample: { email: 'ada@example.com', expiresIn: 24, url: 'https://example.com/auth/delete-account?token=sample' },
})

export const accountDeleted = defineEmail({
  slug: 'account-deleted',
  label: 'Account deleted',
  description: 'Final receipt after an account has been removed.',
  trigger: 'Better Auth user.deleteUser.afterDelete',
  group: 'Account',
  audience: 'user',
  inputSchema: [
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text' },
    { name: 'deletedAt', type: 'date', required: true },
  ],
  variables: {
    email: { example: 'ada@example.com' },
    name: { description: 'Display name at the time of deletion', example: 'Ada Lovelace' },
    deletedAt: { description: 'When the account was removed', example: '2026-09-08T10:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { deletedAt, email, name } = as<{ deletedAt: string; email: string; name?: string }>(input)
    return { deletedAt, email, name: name || email }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Your {{site.name}} account has been deleted',
    preheader: 'Nothing further is needed from you.',
    body: `
Your {{site.name}} account for **{{email}}** was deleted on {{deletedAt}}. Nothing further is needed from you.

If any of this is a surprise, write to [{{support.email}}](mailto:{{support.email}}) — some records are kept briefly for legal reasons, so there may still be time to help.

Thanks for the time you spent with us. You are welcome back at [{{site.name}}]({{url.home}}) whenever you like.
`,
  },
  sample: { deletedAt: new Date().toISOString(), email: 'ada@example.com', name: 'Ada Lovelace' },
})
