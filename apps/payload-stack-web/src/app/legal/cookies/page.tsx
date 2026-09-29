import type { Metadata } from 'next'
import { ManageConsentButton } from '@payload-solutions/consent-react'
import { CookieTable } from '@/components/legal/generated-tables'
import { LegalPage, PolicyVersion } from '@/components/legal/legal-page'
import { COMPANY } from '@/lib/consent'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  alternates: { canonical: '/legal/cookies' },
}

/* Follows payload.solutions/legal/cookies; the table is generated from consentConfig. */
export default function CookiesPage() {
  const { legalName, name, email } = COMPANY

  return (
    <LegalPage title="Cookie Policy">
      <PolicyVersion />

      <p>
        This Cookie Policy explains how {legalName} (&ldquo;{name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) uses
        cookies and similar technologies on payloadstack.com (the &ldquo;Site&rdquo;). It should be read together
        with our <a href="/legal/privacy">Privacy Policy</a>.
      </p>

      <h2>What are cookies?</h2>
      <p>
        Cookies are small data files placed on your device when you visit a website. They help a site work,
        remember your preferences, and understand how it is used. We also use similar technologies such as
        local storage, which behave like cookies. This policy refers to all of them as &ldquo;cookies&rdquo;.
      </p>
      <p>
        Cookies can be session cookies (deleted when you close the browser) or persistent cookies (kept until
        they expire or you delete them), and first-party (set by us) or third-party (set by a provider we
        use).
      </p>

      <h2>What we use</h2>
      <p>
        The tables below are generated from the list of cookies and scripts the consent banner runs on, so
        they always match what actually runs on the Site. Each entry shows the category, the provider, the
        purpose, and how long the data is kept.
      </p>
      <CookieTable />
      <p>
        Necessary cookies do not require your consent: without them the Site does not work as you asked it to
        (remembering this very choice, and the theme you picked). Everything in the other categories runs only
        after you allow it.
      </p>

      <h2>Your choices</h2>
      <p>
        When you first visit, a banner lets you accept all, reject all, or choose per category. Refusing is as
        easy as accepting. You can change your mind at any time via the{' '}
        <ManageConsentButton className="cursor-pointer underline underline-offset-4">
          Cookie settings
        </ManageConsentButton>{' '}
        link in the footer, which reopens the preferences dialog. If you switch a category off, some services
        already running may need a page reload to stop.
      </p>
      <p>
        We ask everyone before running analytics, wherever you are, so nothing in that category runs until
        you allow it.
      </p>
      <p>
        You can additionally block or delete cookies in your browser settings. Blocking necessary cookies means
        the Site cannot remember your choices.
      </p>

      <h2>How long is my choice remembered?</h2>
      <p>
        Your choice is stored in a first-party cookie for six months. We ask again after that, or earlier if
        this policy or our cookie categories change in a way that matters.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this Cookie Policy when the cookies we use change. The effective date above tells you
        when it was last revised.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about cookies or this policy: <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </LegalPage>
  )
}
