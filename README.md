# Payload Solutions

Open-source products, plugins and websites for teams building SaaS on [Payload CMS](https://payloadcms.com). One monorepo, one brand system, MIT licensed.

| Path | What | Where it ships |
| --- | --- | --- |
| `templates/payload-stack` | **Payload Stack**, the SaaS boilerplate (Payload 3 + Next.js + Better Auth + organizations + Stripe + shadcn/ui) | `npx create-payload-stack@latest` |
| `packages/create-payload-stack` | The scaffolding CLI | npm `create-payload-stack` |
| `apps/payload-stack-web` | payloadstack.com | Vercel |
| `apps/payload-solutions` | payload.solutions, including all documentation at `/docs/*` | Vercel |
| `packages/brand` | Shared mark, wordmarks, tokens, Tailwind theme | internal |
| `packages/plugin-*` | Payload plugins (consent, emails, Vercel integration, action scheduler, Resend broadcasts) | npm `@payload-solutions/*` |
| `docs/` | MDX documentation rendered by payload.solutions | payload.solutions/docs |

## Plugins

<table>
<tr>
<td width="50%" valign="top">

<img alt="Payload Consent" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/payload-consent/banner.webp">

<sub><b><a href="packages/plugin-consent">Payload Consent</a></b> — cookie categories, trackers, legal pages and consent records in the admin.</sub>

</td>
<td width="50%" valign="top">

<img alt="Payload Emails" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/payload-emails/banner.webp">

<sub><b><a href="packages/plugin-emails">Payload Emails</a></b> — transactional email copy your team edits, previews and test-sends.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img alt="Vercel Integration" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/vercel-integration/banner.webp">

<sub><b><a href="packages/plugin-vercel">Vercel Integration</a></b> — deploy, follow, cancel and roll back Vercel builds from the admin.</sub>

</td>
<td width="50%" valign="top">

<img alt="Payload Action Scheduler" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/payload-action-scheduler/banner.webp">

<sub><b><a href="packages/plugin-action-scheduler">Payload Action Scheduler</a></b> — scheduled and recurring actions with a real admin view.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img alt="Resend Broadcasts" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/banner.webp">

<sub><b><a href="packages/plugin-resend-broadcasts">Resend Broadcasts</a></b> (alpha) — newsletters sent as Resend broadcasts.</sub>

</td>
<td width="50%"></td>
</tr>
</table>

Documentation for each: https://payload.solutions/docs/plugins

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

Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries. Payload Solutions is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Payload CMS, Inc.

## License

MIT. See [LICENSE](./LICENSE).
