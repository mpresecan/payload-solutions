import { consentPlugin } from '@payload-solutions/plugin-consent'
import type { Plugin } from 'payload'

import { adminOnly } from '@/access'
import stack from '@/stack.config'

/**
 * Payload Consent: cookie categories, trackers, consent records, a processor register, the legal
 * pages and the `/api/consent/*` endpoints that drive the banner.
 *
 * Everything a visitor sees is editable in the admin under **Privacy**; everything here is the part
 * that has to agree with the rest of the application, so it is derived from stack.config.ts rather
 * than typed twice.
 *
 * The seeded documents are a starting point, not a policy. `npx payload-consent scan` reports every
 * placeholder still in them: https://payload.solutions/docs/plugins/payload-consent/audit
 */
export const consentPlugins: Plugin[] = [
  consentPlugin({
    // Records are attached to the signed-in user where there is one, so a person asking "what did I
    // agree to, and when" can be answered. Anonymous visitors get a random consent id and no IP.
    recording: { mode: 'linked' },
    // Reading consent records and editing what the banner says are both administrator jobs: a
    // tracker's inline snippet executes on your site, so write access here is deploy access.
    access: { manage: adminOnly },
    seed: {
      company: {
        name: stack.name,
        legalName: stack.legal.legalName ?? stack.legal.company,
        address: stack.legal.address ?? '[REGISTERED ADDRESS]',
        email: stack.legal.email ?? stack.support.email,
        url: stack.url,
        jurisdictions: stack.legal.jurisdictions ?? [stack.legal.jurisdiction],
        governingLaw: stack.legal.jurisdiction,
      },
      // The recipients this stack actually reaches out of the box. They are created *unverified*:
      // the entity and DPA a vendor publishes are often not the ones you contracted with, so each
      // row has to be confirmed under Privacy → Processors before the documents that render it can
      // be trusted. Anything else you wire in is reported by `payload-consent scan`.
      processors: ['resend', 'sentry', ...(stack.billing.provider === 'stripe' ? (['stripe'] as const) : [])],
      // No analytics ship with the stack. Add yours under Privacy → Cookies & scripts (or seed a
      // preset here) and the cookie table, the banner and the script gating all follow.
      trackers: [],
    },
  }),
]
