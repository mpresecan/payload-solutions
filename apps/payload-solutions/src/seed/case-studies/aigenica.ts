import { h2, p, richText, ul } from '../lexical'

/**
 * The second case study, and the first about our own product: aigenica.com, Michael's AI
 * automation agency, built on Payload Stack and running in production.
 *
 * Every technical claim was checked against the AIgenica codebase (November 2026): its
 * package.json, payload.config.ts and AGENTS.md. AIgenica has no paying clients yet, so the
 * outcomes are facts about the build (languages, plugins, one app), never client results.
 */
export const aigenicaCaseStudy = {
  title: 'One Payload app runs the website, the sales CRM and the agents.',
  slug: 'aigenica',
  client: 'AIgenica',
  clientUrl: 'https://aigenica.com',
  publishedAt: '2026-11-16T09:00:00.000Z',
  featured: false,
  summary:
    'AIgenica is a one-person AI automation agency that runs on its own automation. Its website in five languages, its sales CRM, its pitch decks and the AI agents that work the pipeline all live in one Next.js app on one set of Payload collections, scaffolded with Payload Stack.',
  industry: 'AI automation agency',
  location: 'Croatia · working across Europe',
  engagement: 'Our own product · in production',
  author: 'Michael Presecan',
  outcomes: [
    { value: '1 app', label: 'Website, sales CRM, MCP server and pitch decks on the same Payload collections' },
    { value: '5 languages', label: 'English, Croatian, Portuguese, German and Polish, with Payload’s native field localization' },
    { value: '4 plugins', label: 'From payload.solutions, running in production: consent, emails, scheduling and broadcasts' },
    { value: '1 person', label: 'Runs the agency, with agents doing the work in between' },
  ],
  builtWith: [
    { name: 'Payload Stack' },
    { name: 'Payload CMS' },
    { name: 'Next.js' },
    { name: 'Better Auth' },
    { name: 'MongoDB' },
    { name: 'Resend' },
    { name: 'Vercel AI SDK' },
    { name: 'Railway' },
  ],
  cta: {
    title: 'Want your back office, website and agents in one app?',
    body: 'Tell us what your business runs on today. We start from Payload Stack, so the work goes into the parts only your business has.',
  },
  content: richText(
    h2('The company'),
    p(
      '[AIgenica](https://aigenica.com) is my AI automation agency. It works with companies across Europe, from Fortbit d.o.o. in Croatia, and it is one person. That only works if the agency runs on the kind of automation it sells: research, outreach, follow-ups and proposals are prepared by agents, and I make the decisions.',
    ),
    p(
      'So [aigenica.com](https://aigenica.com) is not only a website. It is the website, the sales CRM, the pitch decks and the place the agents work, and all of it is one [Payload](https://payloadcms.com) app.',
    ),

    h2('Starting from Payload Stack'),
    p(
      'The project was scaffolded with npx create-payload-stack, the command behind [Payload Stack](https://www.payloadstack.com). On the first day it already had:',
    ),
    ul(
      '**Payload CMS 3 and Next.js 16** in one app, on MongoDB, deployed to [Railway](https://railway.com) from a Dockerfile',
      '**Sign-in with Better Auth** through payload-auth, and **organizations** bridged into the official multi-tenant plugin',
      '**Legal pages and cookie consent** from [Cookie Consent for Payload](https://payload.solutions/docs/plugins/payload-consent)',
      '**Transactional email** from [Transactional Emails for Payload](https://payload.solutions/docs/plugins/payload-emails), sent through Payload’s email adapter and [Resend](https://resend.com)',
      '**Scheduled work** from [Action Scheduler for Payload](https://payload.solutions/docs/plugins/payload-action-scheduler), on Payload’s own jobs queue',
    ),
    p(
      'Later the newsletter was added with [Resend Broadcasts](https://payload.solutions/docs/plugins/resend-broadcasts). None of this is what AIgenica sells, and none of it took a week of the build.',
    ),

    h2('A website in five languages'),
    p(
      'The public site is written in English, Croatian, Portuguese, German and Polish. It uses Payload’s native field localization, with English as the fallback, so a page is never empty in a language that is not finished yet. Service pages, industry pages and the blog are Payload collections, edited in Payload’s admin.',
    ),
    p(
      'Search is handled in the same place. The official SEO plugin sits on pages and posts, and the site writes hreflang links with an x-default, JSON-LD for the organization, services, breadcrumbs, FAQs and blog posts, a sitemap and an llms.txt. The copy follows StoryBrand: the visitor is the hero, and every page ends in one clear next step.',
    ),

    h2('The CRM lives at /admin'),
    p(
      'Payload’s own admin moved to /payload-admin. The /admin address belongs to a sales CRM built inside the same Next.js app, on the same collections. Leads come in two pipelines: outbound, for companies I research, and inbound, for enquiries from the website. Each lead has its contacts, a timeline of every call, email, booking and status change, and an inbox for everything that still needs an answer.',
    ),
    p(
      'Email goes through Payload’s email adapter and Resend. Replies come back through Resend Receiving webhooks and are filed on the right lead, and every sent email records whether it was delivered, opened or clicked. The CRM is built from coss ui components, installs as an app on a phone, and sends Web Push notifications when a lead replies or books a call. It also speaks: I can dictate a call log and have messages read aloud.',
    ),

    h2('Agents work through Payload'),
    p(
      'The app runs its own MCP server at /api/mcp, with OAuth from Better Auth’s OAuth provider. Claude agents sign in through it and read and write the same collections I do. They find and qualify leads, log what they learned, draft emails and build pitch decks, with the same access rules as a person.',
    ),
    p(
      'The instructions the agents follow are Payload documents too. SOPs, skills and templates are an Operations collection, organised in Payload folders. Each one is stored as Lexical rich text, edited in Payload’s editor, and handed to agents as Markdown. Every save keeps a version, so an instruction that made things worse rolls back from the history.',
    ),
    p(
      'Pitch decks are a Presentations collection made of slide blocks, with drafts, versions and live preview. A published deck has its own public page at /deck/<slug>, a share image drawn for each request, and PostHog analytics that show which slides a lead read.',
    ),

    h2('Background work on Payload’s jobs queue'),
    p(
      'The agents inside the CRM run on the Vercel AI SDK with Claude. Their longer jobs are queued through the Payload Stack scheduler, which is Action Scheduler for Payload on Payload’s jobs queue. Every morning a sweep looks at leads waiting for an answer and drafts a follow-up where one is due. When a lead is ready for a proposal, a chain of agents researches the company, writes the deck and drafts the email, then a reviewer checks the result before it reaches me. Nothing is sent without me.',
    ),

    h2('Why one Payload app'),
    p(
      '**One data model for the website, the CRM and the agents.** A website enquiry, a lead, a deck and the email about that deck are records in the same database. Nothing has to be synced between tools, because there is only one.',
    ),
    p(
      '**Collections are the API.** The website reads them, the CRM writes them, and the agents reach them through MCP under the same access control. Adding a feature for me usually adds it for the agents as well.',
    ),
    p(
      '**Payload Stack took the plumbing off the table.** Sign-in, organizations, consent, email and scheduling were in place from the first commit, so the time went into the CRM and the agents, which are what make AIgenica different.',
    ),

    h2('Building something like it?'),
    p(
      'If your business runs on a website, a CRM and a handful of tools that do not talk to each other, the same approach works for you:',
    ),
    ul(
      '**A multilingual website and a back office** on one set of Payload collections',
      '**A custom CRM or internal tool** built into the app you already run, instead of another subscription',
      '**AI agents that work on your own data** through an MCP server, under your access rules',
    ),
    p('Tell us where you want to start. The form is right below.'),
  ),
}
