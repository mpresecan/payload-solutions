# Handoff: Resend Broadcasts plugin (1 October 2026)

`packages/plugin-resend-broadcasts` = `@payload-solutions/plugin-resend-broadcasts` 0.1.0, scaffolded with `npx create-payload-app@latest -t plugin` (CLI 3.90.2, run in the cloud workspace — npm was reachable this time) and aligned with plugin-emails: Payload pinned to 3.88.0 like the rest of the workspace, exports → `src` with `publishConfig` → `dist`, SQLite dev app on :3500.

Docs: `docs/plugins/resend-broadcasts/` (10 pages). Registered in `docs/plugins/meta.json`, `docs/plugins/index.mdx`, `docs/index.mdx`, `SOURCE_PATHS`, and the catalogue seed (plugin row + roadmap item, both `in-progress`).

## Run on the Mac

```bash
pnpm install                                                      # new workspace package → lockfile
pnpm --filter @payload-solutions/plugin-resend-broadcasts typecheck
pnpm --filter @payload-solutions/plugin-resend-broadcasts test    # unit + int
pnpm --filter @payload-solutions/plugin-resend-broadcasts dev     # http://localhost:3500/admin
pnpm --filter @payload-solutions/plugin-resend-broadcasts test:e2e   # needs `pnpm dev` (reuses it)
```

No Resend account needed: without `RESEND_API_KEY` the dev app serves an in-memory Resend at `/resend-mock` (`/resend-mock/__mock/state` to inspect; `POST /resend-mock/__mock/contacts/<email>/unsubscribe` plays an unsubscribe click and delivers a signed webhook back).

## What was verified (cloud workspace, Node 22, Payload 3.88, SQLite)

- `tsc` for `src` and for `dev/` — clean.
- 10 unit tests (tokens, fallbacks, broadcast placeholders, options validation).
- 26 integration tests against real Payload + the Resend mock: fields added to sources, contact create/update/unsubscribe/move/delete, markup stripping, list segment create/fill/refilter/rename/delete, filter validation, subscriber search, webhook (signed, bad signature, no echo), resync (drift repair, pulled unsubscribes, recreated segment, background run record), preview per subscriber with fallbacks, broadcast placeholders, token validation, test send, send now → sent, schedule → cancel → editable, failure recording, duplicate/forged lifecycle reset.
- 3 Playwright e2e tests against `pnpm dev` (subscriber picker preview, test send, full resync), plus manual browser runs of schedule → cancel → send → status, and the mock's signed unsubscribe webhook end to end.
- ESLint on the package's files: the only remaining error is the template's own "test file not in the project service" parse error for `src/**/*.test.ts` (plugin-emails has the same); the rest are warnings matching plugin-emails' style.
- Docs: all 10 pages + both index pages compile with @mdx-js/mdx 3.1.1 + remark-gfm.

Not verified: real Resend API (no key/egress here — built from the resend 6.31 SDK types and Resend's API docs), Postgres (the commit-wait for background work is written for it, tests ran on SQLite which has no transactions), `pnpm build` (swc).

## Decisions (from Michael, 2026-10-01)

- Name must contain "Resend" → **Resend Broadcasts**, `plugin-resend-broadcasts`, docs `/docs/plugins/resend-broadcasts`.
- Lists = code-declared sources + admin-created lists (source + optional Payload `where` JSON), each mirrored 1:1 onto a Resend segment.
- Standalone from plugin-emails, same template contract (`EmailTemplate`, `TemplateStyles`, `EMAIL_CLASS`), same body editor.
- 0.1 scope: compose, preview per subscriber, test send, send, **scheduling, unsubscribe sync back, full resync**. Stats in admin deferred.

## Design notes worth keeping

- Per-subscriber tokens render as Resend placeholders at send time: `{{firstName|there}}` → `{{{contact.first_name|there}}}`; `{{name}}` → custom property `full_name`; properties → `{{{contact.<key>}}}`; footer always gets `{{{RESEND_UNSUBSCRIBE_URL}}}` and send refuses without it.
- Subject/preview text accept only shared values (`{{site.name}}`…): Resend does not document contact placeholders in the subject.
- Nobody is created in Resend before opting in; unchecking marks the contact unsubscribed (not deleted); unsubscribes from Resend always win in resync.
- Resend values are inserted unescaped (`{{{…}}}`), so `<`/`>` are stripped from names/properties before pushing.
- Client queues all calls at 2 req/s by default and retries 429/5xx/network failures.

## Before publishing

1. Try once against real Resend: full-access key, verified `from`, a webhook to `/api/resend-broadcasts/webhook` with `contact.updated` + `contact.created`. Check that `{{{contact.full_name}}}` and custom properties render in a real broadcast (the docs state `{{{contact.<custom_property>}}}`; worth seeing with your own eyes).
2. Publish (no `prepublishOnly`, so build first): `pnpm --filter @payload-solutions/plugin-resend-broadcasts run build && pnpm --filter @payload-solutions/plugin-resend-broadcasts publish --access public`.
3. Flip the labels: docs `index.mdx` Status, `docs/plugins/index.mdx` table, seed plugin row `in-progress` → `available`, roadmap item → `shipped`. **The seed only runs on empty collections** — change the deployed rows in the payload.solutions admin (or add a migration like `20260908_083000_emails_shipped.ts`).
4. Optionally add it to the home page config plate (`components/config-plate`) if that lists every plugin.

## Update (1 October 2026): Image block

`media: { collection, baseUrl?, allowPrivateUrls? }` adds an **Image** block (upload, alt, width full/half/third, align, link, caption) to the body and footer editors. Rendering populates the uploads, makes URLs absolute (`media.baseUrl` → serverURL → site URL; server-URL URLs are moved onto `baseUrl`), sizes them for the 520px column with width/height attributes, and never upscales. Sending is refused — and the preview shows a red banner with Send disabled — for images on localhost/private hosts (unless `allowPrivateUrls`) and for files Payload serves that an anonymous request cannot read (always). Dev config: media is public-read, `allowPrivateUrls: true`, and the seed generates a banner with sharp. Tests: 13 unit, 31 int.
