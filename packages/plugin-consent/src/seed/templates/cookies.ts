import type { CompanyInfo } from '../../types.js'
import { NOT_LEGAL_ADVICE, formatDate } from './shared.js'

/**
 * Cookie policy whose "what we use" section is the live cookie table generated from the trackers
 * collection. Structure adapted from General Legal's Cookie Notice template (CC0 1.0):
 * https://github.com/General-Legal/legal-templates/tree/main/templates/cookie-notice
 */
export function cookiePolicyMarkdown(company: CompanyInfo, effectiveDate: string): string {
  const name = company.name
  return `${NOT_LEGAL_ADVICE}

Effective ${formatDate(effectiveDate)}.

{{policy-version}}

This Cookie Policy explains how ${company.legalName} ("${name}", "we", "us") uses cookies and similar technologies on ${company.url ?? 'our website and application'} (the "Service"). It should be read together with our [Privacy Policy](/legal/privacy).

## What are cookies?

Cookies are small data files placed on your device when you visit a website. They help a site work, remember your preferences, and understand how it is used. We also use similar technologies such as local storage, pixels and embedded content that behave like cookies. This policy refers to all of them as "cookies".

Cookies can be *session* cookies (deleted when you close the browser) or *persistent* cookies (kept until they expire or you delete them), and *first-party* (set by us) or *third-party* (set by a provider we use).

## What we use

The table below is generated from the list of cookies and scripts we maintain, so it always matches what actually runs on the Service. Each entry shows the category, the provider, the purpose, and how long the data is kept.

{{cookie-table}}

Necessary cookies do not require your consent: without them the Service does not work (signing in, security, remembering this very choice). Everything in the other categories runs only after you allow it.

## Your choices

When you first visit, a banner lets you accept all, reject all, or choose per category. Refusing is as easy as accepting. You can change your mind at any time via the **Cookie settings** link in the footer, which reopens the preferences dialog. If you switch a category off, some services already running may need a page reload to stop.

Where the law requires it, we also honour the **Global Privacy Control** signal sent by your browser and treat it as an opt-out from the relevant categories.

You can additionally block or delete cookies in your browser settings. Blocking necessary cookies may prevent parts of the Service from working.

## How long is my choice remembered?

Your choice is stored in a first-party cookie for up to the period shown in our consent settings (six months by default). We ask again after that, or earlier if this policy or our cookie categories change in a way that matters.

## Changes to this policy

We may update this Cookie Policy when the cookies we use change. The effective date above tells you when it was last revised.

## Contact

Questions about cookies or this policy: ${company.email}.
`
}
