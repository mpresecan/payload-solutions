# payloadstack.com

One-page marketing site for Payload Stack. Static Next.js (App Router, Tailwind v4, Motion), no database.

```bash
pnpm --filter @payload-solutions/stack-web dev     # http://localhost:3100
pnpm --filter @payload-solutions/stack-web build
```

## Structure

- `src/app/` layout, page, `icon.svg`, generated `opengraph-image`, `robots`, `sitemap`
- `src/sections/` one file per section, in page order: hero, built-with, inside, one-command, config, why-payload, open-source
- `src/components/` header, footer, `stack-visual` (the isometric stack), `copy-command` (the primary CTA), theme toggle, reveal
- Design tokens and logos come from `@payload-solutions/brand`

## Keep in sync

- `sections/one-command.tsx` transcript mirrors the real `create-payload-stack` prompt flow
- `sections/config.tsx` mirrors `templates/payload-stack/src/stack.config.ts`
- `/docs` and `/docs/*` redirect to `payload.solutions/docs/payload-stack`
