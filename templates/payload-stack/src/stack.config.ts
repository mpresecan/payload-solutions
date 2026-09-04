import { defineStack } from '@/lib/stack'

/**
 * Your whole product, described in one file.
 *
 * Pricing page, checkout, entitlements, sign-in screens, navigation, legal pages and emails all
 * read from here. Secrets never go in this file: they stay in .env and are read in src/lib/env.ts.
 * Stripe price ids are public identifiers, so they may come from NEXT_PUBLIC_* variables.
 */
export default defineStack({
  name: 'Payload Stack',
  tagline: 'A new SaaS, built on Payload CMS.',
  description:
    'Authentication, organizations, subscriptions and an admin panel, wired together on Payload CMS and Next.js.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  support: { email: 'support@example.com' },

  auth: {
    methods: ['email-password', 'magic-link', 'passkey'],
    social: [],
    twoFactor: true,
    requireEmailVerification: false,
    allowSignUp: true,
  },

  organizations: {
    enabled: true,
    allowUserToCreate: true,
    creatorRole: 'owner',
    teams: false,
  },

  billing: {
    provider: 'stripe',
    attachedTo: 'organization', // or 'user'
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        description: 'For small teams getting started.',
        prices: [
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY ?? 'price_starter_monthly', amount: 2900, currency: 'usd', interval: 'month' },
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY ?? 'price_starter_yearly', amount: 29000, currency: 'usd', interval: 'year' },
        ],
        features: ['Up to 3 members', '10 projects', 'Email support'],
        seats: 3,
        limits: { projects: 10 },
      },
      {
        id: 'team',
        name: 'Team',
        description: 'For growing teams that need room.',
        prices: [
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY ?? 'price_team_monthly', amount: 9900, currency: 'usd', interval: 'month' },
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY ?? 'price_team_yearly', amount: 99000, currency: 'usd', interval: 'year' },
        ],
        features: ['Up to 25 members', 'Unlimited projects', 'Priority support', '14-day free trial'],
        highlighted: true,
        seats: 25,
        trialDays: 14,
        limits: { projects: -1 },
      },
    ],
  },

  legal: {
    company: 'Example Software Ltd',
    jurisdiction: 'Ireland',
  },

  nav: [
    { label: 'Pricing', href: '/pricing' },
    { label: 'Docs', href: 'https://payload.solutions/docs/payload-stack' },
  ],

  social: {
    github: 'https://github.com/mpresecan/payload-solutions',
  },
})
