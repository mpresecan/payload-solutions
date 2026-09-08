/**
 * Example email definitions for the dev app. Each one is a `defineEmail` object: what the caller
 * passes (`inputSchema`), what editors may use (`variables`), how one becomes the other (`resolve`),
 * who receives it (`to`) and the copy that is seeded on first start (`defaults`).
 */
import { defineEmail, populate } from '@payload-solutions/plugin-emails'

type User = { email: string; id: string; name?: null | string }

export const welcome = defineEmail({
  slug: 'welcome',
  label: 'Welcome',
  description: 'Sent once after a user creates an account.',
  trigger: 'users afterChange hook (operation: create)',
  group: 'Auth',
  audience: 'user',
  inputSchema: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'url', type: 'text', required: true, admin: { description: 'Where the button points' } },
  ],
  variables: {
    'user.name': { description: 'Display name, falls back to the email', example: 'Ada Lovelace' },
    'user.email': { example: 'ada@example.com' },
    url: { type: 'url', example: 'http://localhost:3300/admin' },
  },
  resolve: async ({ input, payload }) => {
    const user = await populate<User>(payload, 'users', input.user)
    return { 'user.name': user.name || user.email, 'user.email': user.email, url: input.url }
  },
  to: ({ variables }) => variables['user.email'],
  defaults: {
    subject: 'Welcome to {{site.name}}, {{user.name}}',
    preheader: 'Your account is ready.',
    body: `
Hi {{user.name}},

Thanks for creating an account on [{{site.name}}]({{site.url}}). You can sign in with **{{user.email}}** at any time.

<Button label="Open your dashboard" url="{{url}}" />

Regards,
The {{site.name}} team
`,
  },
  sample: async ({ payload }) => ({
    url: 'http://localhost:3300/admin',
    user: (await payload.find({ collection: 'users', limit: 1 })).docs[0]?.id ?? 'missing-user',
  }),
})

export const passwordReset = defineEmail({
  slug: 'password-reset',
  label: 'Password reset',
  description: 'Sent when a user asks for a password reset link.',
  trigger: 'auth forgotPassword operation',
  group: 'Auth',
  audience: 'user',
  required: true,
  inputSchema: [
    { name: 'email', type: 'email', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'expiresInMinutes', type: 'number', defaultValue: 60 },
  ],
  variables: {
    email: { example: 'ada@example.com' },
    url: { type: 'url', example: 'http://localhost:3300/reset?token=abc' },
    'expires.minutes': { type: 'number', example: 60 },
  },
  resolve: ({ input }) => ({ email: input.email, url: input.url, 'expires.minutes': input.expiresInMinutes ?? 60 }),
  to: ({ input }) => input.email,
  defaults: {
    subject: 'Reset your {{site.name}} password',
    body: `
Someone asked to reset the password for **{{email}}**.

<Button label="Choose a new password" url="{{url}}" />

The link expires in {{expires.minutes}} minutes. If this was not you, ignore this email and nothing will change.
`,
  },
  sample: { email: 'ada@example.com', expiresInMinutes: 60, url: 'http://localhost:3300/reset?token=sample' },
})

export const newUserNotification = defineEmail({
  slug: 'new-user-notification',
  label: 'New user (admin notification)',
  description: 'Tells administrators that someone registered.',
  trigger: 'users afterChange hook (operation: create)',
  group: 'Auth',
  audience: 'admin',
  inputSchema: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'registeredAt', type: 'date', required: true },
  ],
  variables: {
    'user.name': { example: 'Ada Lovelace' },
    'user.email': { example: 'ada@example.com' },
    'user.link': { type: 'url', description: 'Admin link to the user', example: 'http://localhost:3300/admin/collections/users/1' },
    registeredAt: { type: 'date', example: '2026-09-06T10:00:00Z' },
  },
  resolve: async ({ input, payload }) => {
    const user = await populate<User>(payload, 'users', input.user)
    return {
      'user.name': user.name || user.email,
      'user.email': user.email,
      'user.link': `${payload.config.serverURL}/admin/collections/users/${user.id}`,
      registeredAt: input.registeredAt,
    }
  },
  defaults: {
    subject: 'New user on {{site.name}}: {{user.email}}',
    body: `
[{{user.name}}]({{user.link}}) ({{user.email}}) registered on {{registeredAt}}.
`,
  },
  sample: async ({ payload }) => ({
    registeredAt: new Date().toISOString(),
    user: (await payload.find({ collection: 'users', limit: 1 })).docs[0]?.id ?? 'missing-user',
  }),
})

export const emails = [welcome, passwordReset, newUserNotification]
