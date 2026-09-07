# Trademark permission request (draft)

Send from your Fortbit address to **info@payloadcms.com**. Adjust the bracketed parts first. Keep the subject short so it is easy to find in their inbox.

---

**Subject:** Trademark permission request: Payload Solutions, Payload Stack, Payload Clock

Hello Payload team,

I am Michael Presecan, founder of Fortbit d.o.o. We build client SaaS products on Payload and are releasing a set of open-source tools for the Payload community under the MIT license, developed in one public monorepo: https://github.com/mpresecan/payload-solutions

I am betting on Payload CMS, I have been using it since v1. A great product, and I love using it. Now, since v3, I started to do a lot of SaaS applications based on Payload CMS, and the idea is to open source a lot of tools, which would help people to build their SaaS ideas based on Payload CMS.

Your brand guidelines ask for prior written permission before using Payload marks in names, domains or commercial offerings, so I am writing before launch to request it for the following:

**Names and domains**

- Payload Stack, https://payloadstack.com: an open-source SaaS boilerplate for Payload (Better Auth, organizations bridged into the multi-tenant plugin, Stripe billing, shadcn dashboard), scaffolded with `npx create-payload-stack`
- Payload Solutions, https://payload.solutions: the umbrella project and documentation site
- Payload Clock, https://payloadclock.com: a scheduler that wakes Payload job queues on serverless deployments, with a companion plugin. This will be a hosted service; if it ever carries paid tiers we understand that requires your separate written permission and will ask again before charging for it.
- Plugins: Payload Emails, Payload Action Scheduler, Vercel Integration, published under the npm scope `@payload-solutions/*`, plus the unscoped `create-payload-stack` CLI

**Mark**

Our logo is reminesence (altered) from the old Payload CMS logo. We do not use the new Payload logo. I have attached the mark and the three wordmarks.

**What we already do**

- https://payloadstack.com, https://payload.solutions, https://payloadclock.com are freshly online, but never announced anywhere yet, waiting for your consent
- Every site and README carries your attribution line ("Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries.") and states that Payload Solutions is an independent project, not affiliated with, sponsored by or endorsed by Payload CMS, Inc.
- The Payload name is never shown more prominently than our own product names.
- All code is MIT licensed and the sites link to payloadcms.com and your documentation throughout.

If any of the names or domains is a problem, please let us know, we want to work in accordance with your rules. Happy to share a preview of the sites or hop on a call.

Thank you for Payload, and for considering this.

Michael Presecan
Fortbit d.o.o.
[phone] · [website]

---

**Attachment:** `notes/payload-solutions-marks.png` (mark and the three wordmarks on light and dark, rendered from `packages/brand/src/logos.tsx`).

**If they decline the names:** the rename touches `packages/brand/src/brands.ts` (names, domains), the three `package.json` names, `docs/**`, and the CLI package name on npm. Domains would need new registrations; the code paths are otherwise brand-agnostic.
