# Payload Solutions

Open-source products, plugins and websites for teams building SaaS on [Payload CMS](https://payloadcms.com). One monorepo, one brand system, MIT licensed.

| Path | What | Where it ships |
| --- | --- | --- |
| `templates/payload-stack` | **Payload Stack**, the SaaS boilerplate (Payload 3 + Next.js + Better Auth + organizations + Stripe + shadcn/ui) | `npx create-payload-stack@latest` |
| `packages/create-payload-stack` | The scaffolding CLI | npm `create-payload-stack` |
| `apps/payload-stack-web` | payloadstack.com | Vercel |
| `apps/payload-solutions` | payload.solutions, including all documentation at `/docs/*` | Vercel |
| `packages/brand` | Shared mark, wordmarks, tokens, Tailwind theme | internal |
| `packages/plugin-*` | Payload plugins (emails, Vercel integration, action scheduler) | npm `@payload-solutions/*` |
| `docs/` | MDX documentation rendered by payload.solutions | payload.solutions/docs |

## Develop

```bash
corepack enable && corepack prepare pnpm@10.28.0 --activate   # or: npm i -g pnpm
pnpm install
pnpm dev:stack-web        # payloadstack.com on :3100
pnpm dev:solutions        # payload.solutions on :3200
pnpm build                # everything, via Turborepo
```

Node 22+ and pnpm 10+.

## Trademark

Payload, the Payload design, and related marks are trademarks or registered trademarks of Payload CMS, Inc. Payload Solutions is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Payload CMS, Inc.

## License

MIT. See [LICENSE](./LICENSE).
