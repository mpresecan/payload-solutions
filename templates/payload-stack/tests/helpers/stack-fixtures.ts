/**
 * Named stack.config.ts inputs that together cover every option the schema in src/lib/stack.ts
 * offers. Tests iterate over `presets` (representative products) or `configMatrix()` (every
 * combination of the discrete options) so a module that reads `stack.features.*` is checked under
 * each value it can take.
 *
 * Add a preset here when you add an option to the schema; the matrix tests pick it up.
 */
import { AUTH_METHODS, SOCIAL_PROVIDERS, type StackInput } from '@/lib/stack'

export type AuthMethod = (typeof AUTH_METHODS)[number]
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export const base: StackInput = {
  name: 'Test App',
  url: 'https://test.example',
  support: { email: 'help@test.example' },
  legal: { company: 'Test Ltd', jurisdiction: 'Ireland' },
}

/** Two plans: one seat-based with a trial and a yearly price, one flat monthly-only. */
export const plans = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams getting started.',
    prices: [{ id: 'price_starter_m', amount: 2900, currency: 'usd', interval: 'month' as const }],
    features: ['Up to 3 members', '10 projects'],
    limits: { projects: 10 },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For growing teams that need room.',
    prices: [
      { id: 'price_team_m', amount: 9900, currency: 'usd', interval: 'month' as const },
      { id: 'price_team_y', amount: 99000, currency: 'usd', interval: 'year' as const },
    ],
    features: ['Up to 25 members', 'Unlimited projects'],
    highlighted: true,
    seats: 25,
    trialDays: 14,
    limits: { projects: -1 },
  },
]

export const presets = {
  /** Only required keys: every default applies. */
  defaults: base,

  /** Solo product: no organizations, no billing. */
  'orgs-off': {
    ...base,
    organizations: { enabled: false },
    billing: { provider: 'none' },
  },

  /** Solo product with per-user Stripe billing. */
  'billing-user-no-orgs': {
    ...base,
    organizations: { enabled: false },
    billing: { provider: 'stripe', attachedTo: 'user', plans },
  },

  /** Organizations on, but subscriptions belong to the user. */
  'billing-user-with-orgs': {
    ...base,
    organizations: { enabled: true },
    billing: { provider: 'stripe', attachedTo: 'user', plans },
  },

  /** The shipped default: organizations with per-organization billing. */
  'billing-org': {
    ...base,
    auth: { methods: ['email-password', 'magic-link', 'passkey'], twoFactor: true },
    organizations: { enabled: true, allowUserToCreate: true, creatorRole: 'owner', teams: false },
    billing: { provider: 'stripe', attachedTo: 'organization', plans, freePlanId: 'starter' },
  },

  /** Organizations with teams. */
  teams: {
    ...base,
    organizations: { enabled: true, teams: true },
  },

  /** Every sign-in method and every social provider, with two-factor. */
  'all-auth': {
    ...base,
    auth: {
      methods: [...AUTH_METHODS],
      social: [...SOCIAL_PROVIDERS],
      twoFactor: true,
      requireEmailVerification: true,
      allowSignUp: true,
    },
  },

  /** Passwordless: magic link only (two-factor cannot apply). */
  'magic-link-only': {
    ...base,
    auth: { methods: ['magic-link'], twoFactor: true },
  },

  /** Passkeys only. */
  'passkey-only': {
    ...base,
    auth: { methods: ['passkey'] },
  },

  /** Invite-only product with verified emails and two-factor switched off. */
  'invite-only': {
    ...base,
    auth: { methods: ['email-password'], twoFactor: false, requireEmailVerification: true, allowSignUp: false },
  },

  /** Custom organization roles, creator gets a custom role. */
  'custom-roles': {
    ...base,
    organizations: {
      enabled: true,
      allowUserToCreate: false,
      creatorRole: 'founder',
      additionalRoles: { founder: 'Founder', billing: 'Billing contact' },
    },
  },

  /** Custom marketing navigation and social links. */
  'custom-nav': {
    ...base,
    tagline: 'Ship faster',
    description: 'A product description.',
    nav: [
      { label: 'Changelog', href: '/changelog' },
      { label: 'Blog', href: 'https://blog.test.example' },
    ],
    social: { github: 'https://github.com/test', twitter: 'https://x.com/test', linkedin: 'https://linkedin.com/company/test' },
    legal: { company: 'Test Ltd', jurisdiction: 'Ireland', address: '1 Test Street, Dublin' },
  },
} satisfies Record<string, StackInput>

export type PresetName = keyof typeof presets

export const presetNames = Object.keys(presets) as PresetName[]

export const presetEntries = presetNames.map((name) => [name, presets[name]] as const)

/** Every non-empty subset of the auth methods, in a stable order. */
export function authMethodSubsets(): AuthMethod[][] {
  const out: AuthMethod[][] = []
  const n = AUTH_METHODS.length
  for (let mask = 1; mask < 1 << n; mask++) {
    out.push(AUTH_METHODS.filter((_, i) => mask & (1 << i)))
  }
  return out
}

export type MatrixCase = {
  name: string
  input: StackInput
  methods: AuthMethod[]
  twoFactor: boolean
  organizations: boolean
  teams: boolean
  billing: 'none' | 'user' | 'organization'
}

/**
 * The full cross product of the discrete options: 7 method subsets × 2 two-factor × organizations
 * (off | on | on with teams) × billing (none | user | organization when organizations are on).
 */
export function configMatrix(): MatrixCase[] {
  const cases: MatrixCase[] = []
  for (const methods of authMethodSubsets()) {
    for (const twoFactor of [true, false]) {
      for (const org of ['off', 'on', 'teams'] as const) {
        const organizations = org !== 'off'
        const teams = org === 'teams'
        const billingModes: MatrixCase['billing'][] = organizations ? ['none', 'user', 'organization'] : ['none', 'user']
        for (const billing of billingModes) {
          const name = `auth=${methods.join('+')} 2fa=${twoFactor} orgs=${org} billing=${billing}`
          cases.push({
            name,
            methods,
            twoFactor,
            organizations,
            teams,
            billing,
            input: {
              ...base,
              auth: { methods, twoFactor },
              organizations: { enabled: organizations, teams },
              billing: billing === 'none' ? { provider: 'none' } : { provider: 'stripe', attachedTo: billing, plans },
            },
          })
        }
      }
    }
  }
  return cases
}

/** Environment variables that satisfy `auth.social` for the given input (see src/lib/auth/options.ts). */
export function socialEnv(input: StackInput): Record<string, string> {
  const env: Record<string, string> = {}
  for (const provider of input.auth?.social ?? []) {
    const prefix = provider.toUpperCase()
    env[`${prefix}_CLIENT_ID`] = `${provider}-client-id`
    env[`${prefix}_CLIENT_SECRET`] = `${provider}-client-secret`
  }
  return env
}
