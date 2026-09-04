# Trademark permission request (draft)

Send from your Fortbit address to **info@payloadcms.com**. Adjust the bracketed parts first. Keep the subject short so it is easy to find in their inbox.

---

**Subject:** Trademark permission request: Payload Solutions, Payload Stack, Payload Clock

Hello Payload team,

I am Michael Presecan, founder of Fortbit d.o.o. [city, country]. We build client SaaS products on Payload and are releasing a set of open-source tools for the Payload community under the MIT license, developed in one public monorepo: https://github.com/mpresecan/payload-solutions

Your brand guidelines ask for prior written permission before using Payload marks in names, domains or commercial offerings, so I am writing before launch to request it for the following:

**Names and domains**

- Payload Solutions, payload.solutions: the umbrella project and documentation site
- Payload Stack, payloadstack.com: an open-source SaaS boilerplate for Payload (Better Auth, organizations bridged into the multi-tenant plugin, Stripe billing, shadcn dashboard), scaffolded with `npx create-payload-stack`
- Payload Clock, payloadclock.com: a scheduler that wakes Payload job queues on serverless deployments, with a companion plugin. This will be a hosted service; if it ever carries paid tiers we understand that requires your separate written permission and will ask again before charging for it.
- Plugins: Payload Emails, Payload Action Scheduler, Vercel Integration, published under the npm scope `@payload-solutions/*`, plus the unscoped `create-payload-stack` CLI

**Mark**

Our logo is our own mark in an isometric style [that echoes the Payload logo]. We do not use or modify the Payload logo itself. I have attached the mark and the three wordmarks so you can judge whether it is too close for comfort.

**What we already do**

- Every site and README carries your attribution line ("Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries.") and states that Payload Solutions is an independent project, not affiliated with, sponsored by or endorsed by Payload CMS, Inc.
- The Payload name is never shown more prominently than our own product names.
- All code is MIT licensed and the sites link to payloadcms.com and your documentation throughout.

If any of the names or domains is a problem, we are prepared to rename (for example "Stack for Payload") before launch. Happy to share a preview of the sites or hop on a call.

Thank you for Payload, and for considering this.

Michael Presecan
Fortbit d.o.o.
[phone] · [website]

---

**Attachment:** `notes/payload-solutions-marks.png` (mark and the three wordmarks on light and dark, rendered from `packages/brand/src/logos.tsx`).

**If they decline the names:** the rename touches `packages/brand/src/brands.ts` (names, domains), the three `package.json` names, `docs/**`, and the CLI package name on npm. Domains would need new registrations; the code paths are otherwise brand-agnostic.
