# @payload-solutions/plugin-consent

**Payload Consent** — cookie categories, trackers, legal pages and consent records managed in the Payload admin. One config endpoint drives the banner, the script gating and the generated cookie table, so they can never disagree.

Documentation: **https://payload.solutions/docs/plugins/payload-consent**

```bash
pnpm add @payload-solutions/plugin-consent @payload-solutions/consent-react
```

```ts
// payload.config.ts
import { consentPlugin } from '@payload-solutions/plugin-consent'

export default buildConfig({
  plugins: [
    consentPlugin({
      seed: {
        company: { name: 'Acme', legalName: 'Acme Ltd', address: '1 Main St, Dublin', email: 'privacy@acme.com', url: 'https://acme.com' },
        trackers: ['posthog-eu', 'stripe'],
        processors: ['vercel', 'neon', 'resend', 'stripe', 'posthog-eu', 'sentry'],
      },
    }),
  ],
})
```

## What it adds

| Slug | Kind | Purpose |
| --- | --- | --- |
| `consent-settings` | global | banner copy, jurisdictions, re-consent rules, recording, Consent Mode, versions |
| `consent-categories` | collection | the choices visitors see (`necessary`, `functional`, `analytics`, `marketing`, …) |
| `consent-trackers` | collection | every script, pixel, embed or cookie, with its category, loader and cookie rows |
| `consent-records` | collection | immutable proof of decisions (no IP), purged after the retention period |
| `consent-processors` | collection (optional) | everyone who receives personal data: recipients, transfers, sub-processors, DPA annex |
| `legal-pages` | collection (optional) | privacy, terms, cookie policy, sub-processors, DPA — with live **cookie table** and **processor table** blocks |
| `GET /api/consent/config` | endpoint | everything a client needs, jurisdiction resolved from CDN headers |
| `POST /api/consent/records` | endpoint | records a decision (zod-validated, rate limited) |
| `GET /api/consent/records/me` | endpoint | the logged-in user's consent history |
| `GET /api/consent/subprocessors` | endpoint | the published sub-processor list, its version and change log |
| `consentPurgeRecords` | job task | retention purge |
| `consent-audits` | collection (optional) | stored legal audits, **admin-only**, with per-finding acceptance and a required reason |
| `ConsentOverview` | admin component | dashboard widget (`@payload-solutions/plugin-consent/rsc#ConsentOverview`) |
| `payload-consent` | CLI + MCP server | the legal audit: `init`, `scan`, `mcp`, `apply`, `profile` |

## Legal audit

```bash
npx payload-consent init    # MCP server entry, the legal skill, AGENTS.md
npx payload-consent scan    # deterministic checks: no model, no network, no API key
```

`scan` compares your documents against your own configuration and proves what it finds: template
tokens printed literally, processor rows nobody verified, a locale with no translation, a vendor
in `package.json` that appears in no recipients table, personal data in your Payload schema that
the register does not account for. It needs a database but not published pages, so the best time
to run it is before launch.

`mcp` starts a stdio MCP server your own agent drives — Claude Code, Cursor, Codex, whatever you
already use. **The package contains no model code and no AI SDK**: model-agnostic here is the
absence of a wrapper, not a wrapper over four providers. The agent reads pages as markdown (with
`{{cookie-table}}`-style tokens for generated tables), walks a checklist with citations, and must
quote the text behind every judgement it reports.

Legal facts — the controller's identity, the legal basis per purpose, retention periods — are
never invented. The agent asks you in the terminal and records the answer on the compliance
profile; `consent_propose` **refuses** any draft that depends on an unanswered question. Drafts
land as draft versions of the page and are never published.

Full documentation: **https://payload.solutions/docs/plugins/payload-consent/audit**

## Frontend

React / Next.js: `@payload-solutions/consent-react`. Any other frontend: fetch `/api/consent/config` and use `@payload-solutions/consent-core`.

```tsx
// app/layout.tsx (Next.js App Router)
import { cookies, headers } from 'next/headers'
import { getConsentConfig } from '@payload-solutions/plugin-consent/server'
import { ConsentModeScript, ConsentProvider } from '@payload-solutions/consent-react'
import { ConsentBanner } from '@/components/consent/consent-banner' // npx shadcn@latest add https://payload.solutions/r/consent-banner.json

const payload = await getPayload({ config })
const consent = await getConsentConfig(payload, { headers: await headers() })
const cookie = (await cookies()).get(consent.cookie.name)?.value

<ConsentProvider config={consent} initialCookie={cookie}>
  <ConsentModeScript config={consent} cookie={cookie} />
  {children}
  <ConsentBanner />
</ConsentProvider>
```

Legal pages render with the plugin's converters, which add the cookie-table and
policy-version and processor-table blocks and replace Lexical's inline-styled tables with semantic,
unstyled ones (`<thead>`/`<tbody>`, `scope`d `<th>`, a scroll wrapper):

```tsx
import { RichText } from '@payloadcms/richtext-lexical/react'
import { legalPageConverters } from '@payload-solutions/plugin-consent/rsc'

<RichText
  converters={({ defaultConverters }) => ({ ...defaultConverters, ...legalPageConverters(data) })}
  data={page.content}
/>
```

Server code reads the same cookie the browser wrote:

```ts
import { readConsent } from '@payload-solutions/consent-react/next'
const consent = readConsent(await cookies(), config)
if (consent.has('analytics')) { /* … */ }
```

## Development

This package follows the [Payload plugin template](https://github.com/payloadcms/payload/tree/main/templates/plugin): `src/` is the plugin, `dev/` is a full Next.js + Payload app that uses it.

```bash
cp dev/.env.example dev/.env       # SQLite file, no external services
pnpm dev                           # http://localhost:3320 (frontend demo) and /admin (dev@payloadcms.com / test)
pnpm test:int                      # vitest against a real Payload instance (throwaway SQLite)
PAYLOAD_CONFIG_PATH=$PWD/dev/payload.config.ts node bin.js scan   # the CLI against the dev app
pnpm test:e2e                      # Playwright: admin login, banner flow, cookie table (run `pnpm exec playwright install chromium` once)
pnpm build                         # tsc declarations + swc to dist/
pnpm generate:types                # after changing collections
pnpm generate:importmap            # after adding admin components
```

The dev app seeds four categories, PostHog / GA4 / Stripe / YouTube trackers, seven processors and five legal pages on first boot. Send an `x-vercel-ip-country` header (or `?consent_jurisdiction=US` on the config endpoint) to try other jurisdictions; without a header the opt-in fallback applies. `pnpm dev` runs webpack because Turbopack does not resolve the template's `.js → .tsx` import convention across the workspace; `pnpm dev:turbo` is there if that changes.

## Not legal advice

This plugin helps you publish and enforce your privacy choices. It does not provide legal advice; have the seeded documents reviewed for your jurisdiction. Seeded Terms follow the [Common Paper](https://commonpaper.com) Cloud Service Agreement model (CC BY 4.0); the cookie policy structure is adapted from [General Legal](https://github.com/General-Legal/legal-templates) (CC0).

MIT © Payload Solutions. Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries. This project is independent and not affiliated with Payload CMS, Inc.
