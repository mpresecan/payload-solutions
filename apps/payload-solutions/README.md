# payload.solutions

The Payload Solutions site: products, plugins, roadmap, contact and all documentation at `/docs/*`. Runs on Payload 3 (Postgres) and Next.js; the docs are MDX from the monorepo's `/docs` directory rendered with Fumadocs.

```bash
cp .env.example .env                                  # DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SITE_URL
pnpm --filter @payload-solutions/web dev              # http://localhost:3200, admin at /admin
pnpm --filter @payload-solutions/web build
```

The first admin user is created at `/admin` (Payload's native auth). Products, plugins and roadmap items are seeded on first start (`src/seed`) and edited in the admin afterwards; the homepage revalidates every five minutes.

## Structure

- `src/app/(frontend)/` homepage, `docs/[[...slug]]` (Fumadocs), `api/search` (Orama search index), `sitemap`; `src/app/robots.ts`
- `src/app/(payload)/` Payload admin and REST/GraphQL routes (generated files, regenerate with `pnpm generate:importmap`)
- `src/collections/` `products`, `plugins`, `roadmap-items`, `contact-submissions` (public create only), `media`, `users`
- `src/sections/` homepage sections in page order: hero, statement, products, plugins, roadmap, contact (server action)
- `src/lib/source.ts` docs collection (`fumadocs-mdx/macro`, `dir: '../../docs'`); `source.config.ts` global MDX options
- `src/components/` header, footer, `family-visual` (the isometric stack from `@payload-solutions/brand`), theme toggle, reveal, copy command

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (required, also at build time: the homepage is prerendered) |
| `PAYLOAD_SECRET` | Payload secret (required) |
| `NEXT_PUBLIC_SITE_URL` | Public origin, `https://payload.solutions` in production |
| `RESEND_API_KEY` | Optional. Enables email; contact notifications go to `CONTACT_NOTIFY_EMAIL` |

## Docs

Write MDX in `/docs`, navigation in each folder's `meta.json`. New pages are picked up by the dev server and included in the search index and sitemap automatically. Component docs and product pages link here from payloadstack.com.
