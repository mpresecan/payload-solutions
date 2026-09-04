/**
 * Every route the app links to, in one place. Change a URL here and the sidebar, redirects,
 * emails and Better Auth UI base paths follow.
 */
export const paths = {
  home: '/',
  pricing: '/pricing',
  legal: (slug: string) => `/legal/${slug}`,

  auth: {
    base: '/auth',
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    signOut: '/auth/sign-out',
    forgotPassword: '/auth/forgot-password',
    acceptInvitation: '/auth/accept-invitation',
  },

  onboarding: '/onboarding',

  dashboard: {
    home: '/dashboard',
    projects: '/dashboard/projects',
    settings: '/dashboard/settings',
    account: '/dashboard/settings/account',
    security: '/dashboard/settings/security',
    organizations: '/dashboard/settings/organizations',
    billing: '/dashboard/settings/billing',
    organization: '/dashboard/organization',
    organizationSettings: '/dashboard/organization/settings',
    organizationPeople: '/dashboard/organization/people',
    organizationBilling: '/dashboard/organization/billing',
    admin: '/dashboard/admin',
  },

  /** Payload's admin panel: the back office. */
  payloadAdmin: '/admin',
} as const
