import { defineEmail } from '@payload-solutions/plugin-emails'

import { as, str } from './shared'

/**
 * Organization membership. Included only when `organizations.enabled` is true in stack.config.ts —
 * see ./index.ts — so a single-user product never shows these in the admin.
 *
 * Every one of them is triggered by a Better Auth organization hook (src/emails/hooks.ts), which
 * passes the organization and the person it concerns as plain values.
 */

const orgInput = [
  { name: 'email', type: 'email' as const, required: true, admin: { description: 'Who the message goes to' } },
  { name: 'name', type: 'text' as const, admin: { description: 'Their display name' } },
  { name: 'organizationName', type: 'text' as const, required: true },
]

const orgVariables = {
  email: { description: 'Recipient address', example: 'ada@example.com' },
  name: { description: 'Recipient name, falling back to the address', example: 'Ada Lovelace' },
  'organization.name': { description: 'Organization the message is about', example: 'Acme Inc' },
}

function resolveOrg(input: unknown) {
  const { email, name, organizationName } = as<{ email: string; name?: string; organizationName: string }>(input)
  return { email, name: name || email, 'organization.name': organizationName }
}

export const organizationInvitation = defineEmail({
  slug: 'organization-invitation',
  label: 'Organization invitation',
  description: 'Invites someone to join an organization.',
  trigger: 'Better Auth organization.sendInvitationEmail',
  group: 'Organizations',
  audience: 'user',
  required: true,
  inputSchema: [
    ...orgInput,
    { name: 'url', type: 'text', required: true },
    { name: 'role', type: 'text' },
    { name: 'inviterName', type: 'text' },
    { name: 'inviterEmail', type: 'email' },
    { name: 'expiresIn', type: 'number', defaultValue: 48, admin: { description: 'Validity in hours' } },
  ],
  variables: {
    ...orgVariables,
    url: { description: 'Link that accepts the invitation', example: 'https://example.com/auth/accept-invitation?invitationId=…', type: 'url' },
    role: { description: 'Role they are invited as', example: 'admin' },
    'inviter.name': { description: 'Who sent it, falling back to their address or "Someone"', example: 'Mira Chen' },
    'inviter.email': { example: 'mira@example.com' },
    'expires.hours': { description: 'Validity in hours', example: 48, type: 'number' },
  },
  resolve: ({ input }) => {
    const { expiresIn, inviterEmail, inviterName, role, url } = as<{
      expiresIn?: number
      inviterEmail?: string
      inviterName?: string
      role?: string
      url: string
    }>(input)
    return {
      ...resolveOrg(input),
      url,
      role: role || 'member',
      'inviter.name': inviterName || inviterEmail || 'Someone',
      'inviter.email': inviterEmail ?? '',
      'expires.hours': expiresIn ?? 48,
    }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: '{{inviter.name}} invited you to {{organization.name}} on {{site.name}}',
    preheader: 'Join {{organization.name}} as {{role}}.',
    body: `
{{inviter.name}} invited you to join **{{organization.name}}** on {{site.name}} as {{role}}.

<Button label="Accept the invitation" url="{{url}}" />

The invitation expires in {{expires.hours}} hours. If you do not know {{organization.name}}, ignore this message — nothing is shared with them until you accept.
`,
  },
  sample: {
    email: 'ada@example.com',
    expiresIn: 48,
    inviterEmail: 'mira@example.com',
    inviterName: 'Mira Chen',
    organizationName: 'Acme Inc',
    role: 'admin',
    url: 'https://example.com/auth/accept-invitation?invitationId=sample',
  },
})

export const organizationMemberJoined = defineEmail({
  slug: 'organization-member-joined',
  label: 'Welcome to the organization',
  description: 'Greets someone who has just become a member.',
  trigger: 'Better Auth organizationHooks.afterAddMember / afterAcceptInvitation',
  group: 'Organizations',
  audience: 'user',
  inputSchema: [...orgInput, { name: 'role', type: 'text' }],
  variables: { ...orgVariables, role: { description: 'Role they joined as', example: 'member' } },
  resolve: ({ input }) => {
    const { role } = as<{ role?: string }>(input)
    return { ...resolveOrg(input), role: role || 'member' }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'You are now part of {{organization.name}}',
    preheader: 'Your access is active.',
    body: `
Hi {{name}},

You are now a member of **{{organization.name}}** on {{site.name}}, with the {{role}} role.

<Button label="Open {{organization.name}}" url="{{url.dashboard}}" fallback="false" />

Everything the organization shares is available to you from the dashboard. Your own sign-in details stay under [your account]({{url.account}}).
`,
  },
  sample: { email: 'ada@example.com', name: 'Ada Lovelace', organizationName: 'Acme Inc', role: 'member' },
})

export const organizationInvitationAccepted = defineEmail({
  slug: 'organization-invitation-accepted',
  label: 'Invitation accepted (to the inviter)',
  description: 'Tells whoever sent an invitation that it was accepted.',
  trigger: 'Better Auth organizationHooks.afterAcceptInvitation',
  group: 'Organizations',
  audience: 'user',
  inputSchema: [
    { name: 'email', type: 'email', required: true, admin: { description: 'The inviter' } },
    { name: 'organizationName', type: 'text', required: true },
    { name: 'memberName', type: 'text' },
    { name: 'memberEmail', type: 'email', required: true },
    { name: 'role', type: 'text' },
  ],
  variables: {
    email: { description: 'The inviter, who receives this', example: 'mira@example.com' },
    'organization.name': { example: 'Acme Inc' },
    'member.name': { description: 'Who accepted, falling back to their address', example: 'Ada Lovelace' },
    'member.email': { example: 'ada@example.com' },
    role: { example: 'admin' },
  },
  resolve: ({ input }) => {
    const { email, memberEmail, memberName, organizationName, role } = as<{
      email: string
      memberEmail: string
      memberName?: string
      organizationName: string
      role?: string
    }>(input)
    return {
      email,
      'member.email': memberEmail,
      'member.name': memberName || memberEmail,
      'organization.name': organizationName,
      role: role || 'member',
    }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: '{{member.name}} joined {{organization.name}}',
    preheader: 'Your invitation was accepted.',
    body: `
{{member.name}} ({{member.email}}) accepted your invitation and joined **{{organization.name}}** as {{role}}.

<Button label="Manage members" url="{{url.dashboard}}" fallback="false" />
`,
  },
  sample: {
    email: 'mira@example.com',
    memberEmail: 'ada@example.com',
    memberName: 'Ada Lovelace',
    organizationName: 'Acme Inc',
    role: 'admin',
  },
})

export const organizationRoleChanged = defineEmail({
  slug: 'organization-role-changed',
  label: 'Role changed',
  description: 'Tells a member their permissions in an organization changed.',
  trigger: 'Better Auth organizationHooks.afterUpdateMemberRole',
  group: 'Organizations',
  audience: 'user',
  inputSchema: [
    ...orgInput,
    { name: 'role', type: 'text', required: true },
    { name: 'previousRole', type: 'text' },
  ],
  variables: {
    ...orgVariables,
    role: { description: 'The new role', example: 'admin' },
    'role.previous': { description: 'The role before the change', example: 'member' },
  },
  resolve: ({ input }) => {
    const { previousRole, role } = as<{ previousRole?: string; role: string }>(input)
    return { ...resolveOrg(input), role, 'role.previous': previousRole ?? '' }
  },
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'Your role in {{organization.name}} is now {{role}}',
    preheader: 'Your permissions changed.',
    body: `
Hi {{name}},

Your role in **{{organization.name}}** changed from {{role.previous}} to **{{role}}**. What you can see and do there changed with it.

<Button label="Open {{organization.name}}" url="{{url.dashboard}}" fallback="false" />

If this looks wrong, speak to an owner of {{organization.name}}.
`,
  },
  sample: {
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    organizationName: 'Acme Inc',
    previousRole: 'member',
    role: 'admin',
  },
})

export const organizationMemberRemoved = defineEmail({
  slug: 'organization-member-removed',
  label: 'Removed from organization',
  description: 'Tells someone their membership has ended.',
  trigger: 'Better Auth organizationHooks.afterRemoveMember',
  group: 'Organizations',
  audience: 'user',
  inputSchema: orgInput,
  variables: orgVariables,
  resolve: ({ input }) => resolveOrg(input),
  to: ({ variables }) => str(variables.email),
  defaults: {
    subject: 'You no longer have access to {{organization.name}}',
    preheader: 'Your membership ended.',
    body: `
Hi {{name}},

Your membership of **{{organization.name}}** on {{site.name}} has ended, so you no longer have access to what that organization shares.

Your own {{site.name}} account is untouched — you can still [sign in]({{url.signIn}}), and anything outside {{organization.name}} is where you left it.

If you think this is a mistake, speak to an owner of {{organization.name}}.
`,
  },
  sample: { email: 'ada@example.com', name: 'Ada Lovelace', organizationName: 'Acme Inc' },
})
