import type { Metadata } from 'next'
import { INDEPENDENCE_NOTICE, PAYLOAD_TRADEMARK_ATTRIBUTION, brands } from '@payload-solutions/brand'
import { ContactBlock, LegalPage } from '@/components/legal/legal-page'
import { COMPANY } from '@/lib/consent'

export const metadata: Metadata = {
  title: 'Terms of Use',
  alternates: { canonical: '/legal/terms' },
}

/*
  payload.solutions uses plugin-consent's Common Paper cloud-service cover page, written for a
  paid SaaS. payloadstack.com sells nothing and hosts nothing for anyone, so these are website
  terms of use instead: the software itself is governed by its MIT licence, not by this page.
*/
export default function TermsPage() {
  const { legalName, name, email, governingLaw } = COMPANY
  const mail = <a href={`mailto:${email}`}>{email}</a>

  return (
    <LegalPage title="Terms of Use">
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) govern your use of the website at payloadstack.com (the
        &ldquo;Site&rdquo;), operated by {legalName} (&ldquo;{name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By
        using the Site you agree to them. If you do not agree, please do not use the Site.
      </p>

      <h2>1. The Site and the software</h2>
      <p>
        The Site describes Payload Stack, an open-source SaaS boilerplate, and links to its source code and
        documentation. The software is licensed under the{' '}
        <a href={`${brands.stack.github}/blob/main/LICENSE`} rel="noopener noreferrer" target="_blank">
          MIT License
        </a>
        . Your use, copying, modification and distribution of the software is governed by that licence, not
        by these Terms, and nothing here limits the rights it gives you.
      </p>
      <p>
        The Site is provided free of charge. There are no accounts, subscriptions or payments on it.
      </p>

      <h2>2. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Site in a way that breaks the law or infringes anyone&rsquo;s rights;</li>
        <li>
          attempt to gain unauthorised access to the Site or the systems that host it, or interfere with its
          operation, including by overloading it with automated requests;
        </li>
        <li>use the Site to distribute malware or to impersonate us.</li>
      </ul>

      <h2>3. Content and trademarks</h2>
      <p>
        The Site&rsquo;s text, design, logos and the Payload Stack name belong to us or our licensors. Except for
        the software under its MIT License, you may not reuse them in a way that suggests we endorse you or
        your product.
      </p>
      <p>
        {PAYLOAD_TRADEMARK_ATTRIBUTION} {INDEPENDENCE_NOTICE} Other names and logos on the Site belong to their
        respective owners and are used only to identify their products.
      </p>

      <h2>4. Links to other websites</h2>
      <p>
        The Site links to websites we do not control, such as GitHub, the Payload Stack documentation at
        payload.solutions, and the projects Payload Stack is built on. We are not responsible for their
        content or practices, and their own terms apply.
      </p>

      <h2>5. No warranty</h2>
      <p>
        The Site and its content are provided &ldquo;as is&rdquo; for general information. We try to keep them
        accurate and available, but we do not guarantee that they are complete, current or free of errors, or
        that the Site will always be available.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for any indirect or consequential loss arising from
        your use of the Site. Nothing in these Terms limits liability for intent or gross negligence, for death
        or personal injury, or any other liability that cannot be limited by law.
      </p>
      <p>
        If you are a consumer, the mandatory protections of the law of the country where you live apply, and
        nothing in these Terms limits them.
      </p>

      <h2>7. Privacy</h2>
      <p>
        How we handle personal data on the Site is described in our <a href="/legal/privacy">Privacy Policy</a>{' '}
        and <a href="/legal/cookies">Cookie Policy</a>.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms. The effective date at the top tells you when they were last revised, and
        the version in force when you use the Site applies.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the law of {governingLaw}. The courts of {governingLaw} have jurisdiction,
        without depriving a consumer of the protection of the courts of their own country where the law
        provides it.
      </p>

      <h2>10. Contact</h2>
      <ContactBlock />
      <p>Questions about these Terms: {mail}.</p>
    </LegalPage>
  )
}
