# Docs screenshots

The plugin docs on payload.solutions embed admin screenshots with the `<Screenshot>` MDX component
(`apps/payload-solutions/src/components/screenshot.tsx`):

```mdx
<Screenshot name="payload-emails/editor" alt="What the image shows" caption="Optional line under it." />
<Screenshot name="vercel-integration/header" alt="…" width={800} height={56} />
```

- Files live in `apps/payload-solutions/public/images/docs/<plugin>/<name>-light.webp` and `-dark.webp`.
  Both are required; the one matching the site theme is shown (the brand's `only-light` / `only-dark`
  utilities), and a click zooms it (Fumadocs `ImageZoom`).
- They are captured at 2× from a 1440×900 viewport, so `width`/`height` default to 1440×900. Crops pass
  their CSS-pixel size and are never shown wider than that.
- `next.config.ts` allows `/images/**` in `images.localPatterns` so `next/image` can serve them.

## Regenerating

The harness is in `notes/docs-screenshots/` (Playwright, run from a plugin package so it resolves
`playwright` and `sharp` from there). For each plugin:

1. Start the plugin's dev app (`pnpm dev` in `packages/plugin-*`; the Vercel one also needs
   `node dev/vercel-mock/server.mjs` and the env from `dev/.env.example`, with a long
   `VERCEL_QUIET_PERIOD` such as `25m` and `VERCEL_MAX_WAIT=60m` so the countdowns stay on screen).
2. Seed realistic data: `node ../../notes/docs-screenshots/seed-<plugin>.mjs` (the scheduler one wants
   `SCHEDULER_AUTORUN=false` on the dev app; Resend Broadcasts seeds itself on first boot).
3. Capture both themes: `node ../../notes/docs-screenshots/run.mjs <docs-folder> http://localhost:<port>`,
   e.g. `run.mjs payload-emails http://localhost:3300`. `ONLY=a,b` and `THEMES=light` narrow a run;
   `CHROMIUM_PATH` points at a browser when Playwright's own download is missing.
4. Convert: `node ../../notes/docs-screenshots/convert.mjs` writes the WebP files into the app.

Steps per plugin are in `steps-<docs-folder>.mjs`: a path, optional nav-open, a `prep(page, theme)`
that clicks into the state to show, and an optional clip or locator.

Things learned while capturing (2026-10-02):

- Payload's Next dev server spawns a `payload generate:types` child that outlives a killed server; a
  few of those saturate a small machine. Kill them along with the server.
- The JSON field editor (Monaco) loads from a CDN; with no network it renders an empty box, so pages
  showing a JSON field with a value (a Resend list filter) were shot on a document without one.
- Payload's header actions area is capped at 600px — anything wider overlaps the account icon.

## README banners

Each plugin README opens with `public/images/docs/<plugin>/banner.webp` (1280×640 at 2×): the plugin
name over an original dark, streaked background, with a light admin screenshot as a card below.

The card screenshots are captured at the card's own width (`card.mjs`, viewport 1120 CSS px; 1300 for
the scheduler table, scaled down), so the admin reflows to fit instead of being cropped at the sides:

```sh
node ../../notes/docs-screenshots/card.mjs http://localhost:3300 /admin/collections/transactional-emails/1/preview card/emails.png
```

`banner.mjs` composes them; `sw` is the capture width, `y` the top offset that starts the card at the
page title. Used: scheduler `/admin/collections/scheduled-actions` (sw 1300, y 44), consent `/admin`
(sw 1120, y 8), emails `…/transactional-emails/1/preview` (y 45), vercel `/admin/deployments` (y 0,
header pill visible), resend `…/newsletter-campaigns/1/preview` (y 45).
READMEs load images from `raw.githubusercontent.com/.../main/...`, so they appear once pushed to main.
