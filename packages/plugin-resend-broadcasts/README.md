# @payload-solutions/plugin-resend-broadcasts

Newsletters for Payload CMS on [Resend Broadcasts](https://resend.com/docs/dashboard/broadcasts/introduction). Any collection with an email becomes a subscriber source kept in step with Resend contacts; lists created in the admin become Resend segments; campaigns are written in Lexical, previewed as any person in the list, tested, and sent or scheduled as a Resend broadcast. Unsubscribes come back by signed webhook.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/preview-dark.webp">
  <img alt="Preview & send: a campaign previewed as one subscriber in the list" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/preview-light.webp">
</picture>

Full documentation: **https://payload.solutions/docs/plugins/resend-broadcasts**

## Install

```sh
pnpm add @payload-solutions/plugin-resend-broadcasts
```

Peer dependencies: `payload ^3.88`, `@payloadcms/richtext-lexical`, `@payloadcms/ui`, `react`, `react-dom`. The `resend` SDK and React Email ship with the plugin.

```ts
// payload.config.ts
import { resendBroadcastsPlugin } from '@payload-solutions/plugin-resend-broadcasts'

export default buildConfig({
  collections: [Users, Subscribers],
  plugins: [
    resendBroadcastsPlugin({
      from: 'Acme <news@acme.com>', // a domain verified in Resend
      sources: [
        { collection: 'users' }, // opt-in checkbox added, off by default
        {
          collection: 'subscribers', // email, name and subscribed added if missing
          defaultSubscribed: true,
          properties: { plan: { type: 'string', value: ({ doc }) => doc.plan } },
        },
      ],
    }),
  ],
})
```

```sh
RESEND_API_KEY=re_...            # full access: contacts, segments, broadcasts
RESEND_WEBHOOK_SECRET=whsec_...  # webhook → /api/resend-broadcasts/webhook, events contact.updated + contact.created
pnpm payload generate:importmap && pnpm payload generate:types
```

Add `media: { collection: 'media' }` for an **Image** block in campaigns; the media collection must be readable without a login, because mail clients fetch images anonymously.

In the admin: **Newsletter → Lists** (Resend segments, optionally filtered with a Payload query), **Campaigns** (with the **Preview & send** tab), **Sync runs** and **Newsletter Settings**.

Write `{{firstName|there}}` in a campaign and the preview shows each subscriber's own value; at send time it becomes Resend's `{{{contact.first_name|there}}}`, so the campaign is rendered once and Resend personalises it per contact.

## Screenshots

<table>
<tr>
<td width="50%" valign="top">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/campaign-edit-dark.webp">
  <img alt="Writing a campaign" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/campaign-edit-light.webp">
</picture>

<sub>Campaigns are written in Lexical, with an Image block.</sub>

</td>
<td width="50%" valign="top">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/preview-send-dark.webp">
  <img alt="Send a test, send now or schedule" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/preview-send-light.webp">
</picture>

<sub>Send a test, then send now or schedule — with every variable explained.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/lists-dark.webp">
  <img alt="Lists as Resend segments" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/lists-light.webp">
</picture>

<sub>Lists become Resend segments and stay in sync.</sub>

</td>
<td width="50%" valign="top">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/campaigns-dark.webp">
  <img alt="The campaigns list" src="https://raw.githubusercontent.com/mpresecan/payload-solutions/main/apps/payload-solutions/public/images/docs/resend-broadcasts/campaigns-light.webp">
</picture>

<sub>Drafts, scheduled and sent campaigns.</sub>

</td>
</tr>
</table>

More in the documentation: https://payload.solutions/docs/plugins/resend-broadcasts

## Develop

```sh
pnpm dev          # admin on http://localhost:3500/admin, dev@payloadcms.com / test
pnpm test:unit    # tokens, resolver, options
pnpm test:int     # real Payload + SQLite against the in-memory Resend mock
pnpm test:e2e     # Playwright against `pnpm dev`
```

Without `RESEND_API_KEY` the dev app talks to an in-memory Resend served at `/resend-mock` (see `dev/resend-mock`). `/resend-mock/__mock/state` shows what it received; `POST /resend-mock/__mock/contacts/<email>/unsubscribe` plays a reader unsubscribing and delivers a signed webhook back to the app.

## License

MIT. Resend is a trademark of Resend, Inc.; this plugin is not affiliated with or endorsed by Resend. Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries.
