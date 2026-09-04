# Payload Stack

A SaaS boilerplate on [Payload CMS](https://payloadcms.com) and Next.js. Better Auth, organizations, Stripe subscriptions, a shadcn/ui dashboard and Payload's admin as your back office, wired together and driven by one config file.

Documentation: **https://payload.solutions/docs/payload-stack**

```bash
npx create-payload-stack@latest
```

## What you get

| Area | Implementation |
| --- | --- |
| Authentication | Better Auth through [`payload-auth`](https://payloadauth.com): email + password, magic link, passkeys, TOTP two-factor, social sign-in, impersonation. One session for the app and the Payload admin. |
| Organizations | Better Auth `organization` plugin as the source of truth, bridged into `@payloadcms/plugin-multi-tenant` so every tenant-scoped collection is enforced in the API and the admin. Invitations, roles, switcher. |
| Billing | `@better-auth/stripe`: plans from config, per user or per organization, seats, trials, customer portal, webhooks. |
| UI | Tailwind v4, shadcn/ui (radix-nova), [Better Auth UI](https://better-auth-ui.com) for auth screens, account and security settings, organization management and billing. Dashboard shell from shadcn `sidebar-08`. |
| Admin | Payload's admin at `/admin` for users, organizations, subscriptions, content and support, with a tenant selector. |
| Email | React Email templates sent through Payload's email adapter (Resend in production, console in development). |
| Content | Legal pages as a Payload collection (seeded), rich text with Lexical, media uploads. |
| Config | `src/stack.config.ts` validated with zod; `src/lib/env.ts` validates environment variables at boot. |

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_APP_URL
docker compose up -d          # optional: local PostgreSQL + Mailpit
pnpm install
pnpm dev
```

Open http://localhost:3000/admin. The first visit creates your admin account. Then sign up as a regular user at http://localhost:3000/auth/sign-up to see onboarding, organizations and the dashboard.

## Configure your product

Everything product-specific lives in `src/stack.config.ts`:

```ts
export default defineStack({
  name: 'Ridgeline',
  url: process.env.NEXT_PUBLIC_APP_URL,
  auth: { methods: ['email-password', 'magic-link', 'passkey'], social: ['google'], twoFactor: true },
  organizations: { enabled: true, allowUserToCreate: true },
  billing: { provider: 'stripe', attachedTo: 'organization', plans: [/* ... */] },
  legal: { company: 'Ridgeline Software Ltd', jurisdiction: 'Ireland' },
})
```

Turn organizations or billing off and the related UI, plugins and collections disappear. Add a social provider and the sign-in buttons, server plugin and env validation follow.

## Stripe

1. Create products and prices in Stripe, put the price ids in `.env` (`NEXT_PUBLIC_STRIPE_PRICE_*`).
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. Locally: `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook`.

Checkout, the customer portal, cancel and restore are handled by Better Auth's Stripe plugin and Better Auth UI's billing views (`/dashboard/organization/billing` or `/dashboard/settings/billing`).

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next.js + Payload in development (schema pushed automatically) |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` after changing collections |
| `pnpm generate:importmap` | Regenerate the admin import map after adding plugins or admin components |
| `pnpm db:migrate:create` / `pnpm db:migrate` | Payload migrations for production databases |
| `pnpm email:dev` | Preview email templates at http://localhost:3001 |
| `pnpm test:int` / `pnpm test:e2e` | Vitest integration tests, Playwright end-to-end tests |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |

## Project layout

```
src/
  stack.config.ts          product config
  payload.config.ts        Payload: collections, plugins, db, email
  collections/             Users, Organizations, Projects (example), Media, LegalPages
  access/                  shared access-control helpers
  tenancy/                 Better Auth memberships -> users.tenants bridge
  lib/                     stack schema, env, auth options/client/session, tenancy helpers, paths
  emails/                  transactional email senders
  components/
    ui/                    shadcn/ui
    auth/                  Better Auth UI (auth, settings, organization, billing, emails)
    marketing/             header, footer, pricing table, logo
    dashboard/             sidebar, navigation, header
  app/
    (frontend)/(marketing) home, pricing, legal/[slug]
    (frontend)/auth        auth/[path]
    (frontend)/(app)       onboarding, dashboard/**
    (frontend)/api/auth    Better Auth handler (and Stripe webhook)
    (payload)/             Payload admin and REST/GraphQL
```

## Deploying

Any Node host or Vercel. Set the environment variables from `.env.example`, use a managed PostgreSQL (or the database you chose when scaffolding), and run `pnpm db:migrate` as part of your deploy instead of relying on schema push.

## License

MIT. Payload Stack is a [payload.solutions](https://payload.solutions) project. Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries.; Payload Solutions is not affiliated with or endorsed by Payload CMS, Inc.
