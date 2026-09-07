import type { Payload } from 'payload'

/**
 * Seeds the catalogue on first boot so the site is never empty. Everything is editable in the
 * admin afterwards; the seed only runs when a collection has no documents.
 */
export async function seed(payload: Payload) {
  const products = await payload.count({ collection: 'products', overrideAccess: true })
  if (products.totalDocs === 0) {
    for (const [order, data] of [
      {
        name: 'Payload Stack',
        slug: 'payload-stack',
        tagline: 'The SaaS boilerplate for Payload CMS.',
        description:
          'Better Auth, organizations, Stripe subscriptions and a shadcn dashboard, wired into Payload and Next.js. Scaffold a production-ready SaaS in one command.',
        status: 'available',
        url: 'https://www.payloadstack.com',
        docsPath: '/docs/payload-stack',
        command: 'npx create-payload-stack@latest',
        highlights: [
          { text: 'Better Auth with passkeys, magic links, 2FA and social sign-in' },
          { text: 'Organizations bridged into the Payload multi-tenant plugin' },
          { text: 'Stripe subscriptions per user or per organization' },
          { text: 'Payload admin as your back office' },
        ],
      },
      {
        name: 'Payload Clock',
        slug: 'payload-clock',
        tagline: 'A reliable clock for serverless Payload jobs.',
        description:
          'Payload job queues need something to wake them up. Payload Clock triggers your queues on schedule so serverless deployments never miss a run, with a plugin that shows the next runs inside your admin.',
        status: 'in-progress',
        url: 'https://www.payloadclock.com',
        docsPath: '/docs/payload-clock',
        highlights: [
          { text: 'Cron and interval schedules per queue' },
          { text: 'Retries, alerts and run history' },
          { text: 'Companion plugin for the Payload admin' },
        ],
      },
    ].entries()) {
      await payload.create({ collection: 'products', data: { ...data, order } as never, overrideAccess: true })
    }
  }

  const plugins = await payload.count({ collection: 'plugins', overrideAccess: true })
  if (plugins.totalDocs === 0) {
    for (const [order, data] of [
      {
        name: 'Payload Consent',
        slug: 'payload-consent',
        packageName: '@payload-solutions/plugin-consent',
        summary: 'Cookie categories, trackers, legal pages and consent records in the Payload admin.',
        description:
          'One source of truth for the consent banner, the script gating and the generated cookie table. Jurisdiction-aware (opt-in, opt-out with Global Privacy Control, notice), Google Consent Mode v2, immutable consent records without IP addresses, seeded privacy, terms and cookie policies. React bindings and a shadcn banner included.',
        status: 'available',
        docsPath: '/docs/plugins/payload-consent',
      },
      {
        name: 'Payload Emails',
        slug: 'payload-emails',
        packageName: '@payload-solutions/plugin-emails',
        summary: 'Edit the copy of every automated email from the admin dashboard.',
        description:
          'Verification, password reset, invitation and billing emails become documents your team can edit, preview and version in the Payload admin, with variables for names, links and organizations.',
        status: 'planned',
        docsPath: '/docs/plugins/payload-emails',
      },
      {
        name: 'Vercel Integration',
        slug: 'vercel-integration',
        packageName: '@payload-solutions/plugin-vercel',
        summary: 'Trigger Vercel deploy hooks from the admin and see deployment status.',
        description:
          'A Deploy button and status view in the Payload admin, wired to Vercel build hooks, so content editors can publish static sites without touching Vercel.',
        status: 'planned',
        docsPath: '/docs/plugins/vercel-integration',
      },
      {
        name: 'Payload Action Scheduler',
        slug: 'payload-action-scheduler',
        packageName: '@payload-solutions/plugin-action-scheduler',
        summary: 'A WooCommerce-style action scheduler on top of Payload job queues.',
        description:
          'Schedule one-off and recurring actions with arguments, groups and claims; inspect pending, running and failed actions in the admin, retry or cancel them.',
        status: 'planned',
        docsPath: '/docs/plugins/payload-action-scheduler',
      },
      {
        name: 'Payload Clock plugin',
        slug: 'payload-clock-plugin',
        packageName: '@payload-solutions/plugin-clock',
        summary: 'Connect a Payload project to Payload Clock and see upcoming runs in the admin.',
        status: 'in-progress',
        docsPath: '/docs/payload-clock',
      },
    ].entries()) {
      await payload.create({ collection: 'plugins', data: { ...data, order } as never, overrideAccess: true })
    }
  }

  const roadmap = await payload.count({ collection: 'roadmap-items', overrideAccess: true })
  if (roadmap.totalDocs === 0) {
    for (const [order, data] of [
      { title: 'Payload Stack 0.1', description: 'Better Auth, organizations, Stripe, shadcn dashboard, CLI.', stage: 'shipped', quarter: 'Q3 2026' },
      { title: 'Payload Consent plugin 0.1', description: 'Consent banner, script gating, cookie table and consent records managed in the Payload admin.', stage: 'shipped', quarter: 'Q3 2026' },
      { title: 'Payload Stack documentation', description: 'Guides for configuration, authentication, organizations, billing, deployment.', stage: 'in-progress', quarter: 'Q3 2026' },
      { title: 'Payload Clock beta', description: 'Hosted scheduler for serverless Payload job queues, with the companion plugin.', stage: 'planned', quarter: 'Q4 2026' },
      { title: 'Payload Emails plugin', description: 'Editable transactional email copy in the admin.', stage: 'planned', quarter: 'Q4 2026' },
      { title: 'Payload Action Scheduler plugin', description: 'Scheduled and recurring actions on top of job queues.', stage: 'planned', quarter: 'Q1 2027' },
      { title: 'Vercel Integration plugin', description: 'Deploy hooks and deployment status in the admin.', stage: 'planned', quarter: 'Q1 2027' },
      { title: 'Payload Stack on Payload 4', description: 'Move the boilerplate to Payload 4 once payload-auth supports it.', stage: 'exploring' },
    ].entries()) {
      await payload.create({ collection: 'roadmap-items', data: { ...data, order } as never, overrideAccess: true })
    }
  }
}
