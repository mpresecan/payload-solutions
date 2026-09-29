import type { Metadata } from 'next'
import { RecipientsTable, TransfersTable } from '@/components/legal/generated-tables'
import { ContactBlock, LegalPage, PolicyVersion, Table } from '@/components/legal/legal-page'
import { COMPANY } from '@/lib/consent'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/legal/privacy' },
}

/*
  Follows payload.solutions/legal/privacy (plugin-consent's GDPR Art. 13/14 template), cut down
  to what payloadstack.com does: a static marketing site with no accounts, billing or forms.
  Payload Stack itself is software you run; this policy covers only this website.
*/
export default function PrivacyPage() {
  const { legalName, name, email } = COMPANY
  const mail = <a href={`mailto:${email}`}>{email}</a>

  return (
    <LegalPage title="Privacy Policy">
      <PolicyVersion />

      <h2>1. Who we are</h2>
      <p>
        {legalName} (&ldquo;{name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is the controller of the personal
        data described in this policy, which covers the website at payloadstack.com (the &ldquo;Site&rdquo;). Our
        contact details:
      </p>
      <ContactBlock />
      <p>
        We have not appointed a Data Protection Officer because we are not required to; the contact above
        handles all privacy requests.
      </p>
      <p>
        Payload Stack is open-source software that you download and run on your own infrastructure. We do not
        receive any data from applications you build with it. This policy covers only the Site.
      </p>

      <h2>2. What we collect and why</h2>
      <Table
        head={['Category', 'Examples', 'Purpose', 'Legal basis']}
        rows={[
          [
            'Technical data',
            'IP address, browser and device information, requested page, time of the request',
            'Deliver the Site, keep it secure, prevent abuse, fix problems',
            'Legitimate interests (running a secure website, GDPR Art. 6(1)(f))',
          ],
          [
            'Analytics data',
            'pages visited, interactions such as copying the install command, referrer, approximate location derived from the IP address, error reports — only when you allow analytics cookies',
            'Understand how the Site is used and improve it',
            'Consent (Art. 6(1)(a)), withdrawable at any time',
          ],
          [
            'Correspondence',
            'messages you send us by email and your email address',
            'Answer your requests',
            'Legitimate interests; steps at your request before entering into a contract (Art. 6(1)(b))',
          ],
        ]}
      />
      <p>
        The Site has no user accounts, forms or payments, and we do not ask you for personal data to use it.
        We do not sell personal data. We do not use personal data to make automated decisions that have legal
        or similarly significant effects on you.
      </p>

      <h2>3. Cookies and similar technologies</h2>
      <p>
        We use cookies and comparable technologies. Necessary ones keep the Site working; others run only
        with your consent, which you can give or withdraw at any time through the &ldquo;Cookie settings&rdquo;
        link in the footer. The full list, with providers and durations, is in our{' '}
        <a href="/legal/cookies">Cookie Policy</a>.
      </p>

      <h2>4. Who receives your data</h2>
      <p>
        We share personal data with the providers below. Processors act only on our instructions, under a
        written contract that binds them to confidentiality and appropriate security.
      </p>
      <RecipientsTable />
      <p>
        We may also disclose personal data when the law requires it, to establish or defend legal claims, or
        to a buyer as part of a merger or acquisition — in which case this policy continues to apply until
        you are told otherwise.
      </p>
      <p>
        The Site links to other websites, such as GitHub, the documentation at payload.solutions and the
        projects Payload Stack is built on. Once you follow a link, that website&rsquo;s own privacy policy
        applies.
      </p>

      <h2>5. International transfers</h2>
      <p>
        Some of these providers process data outside the European Economic Area. Every such transfer rests on
        one of the safeguards in Chapter V of the GDPR, listed per provider below. You can ask us for a copy of
        the Standard Contractual Clauses we rely on at {mail}.
      </p>
      <TransfersTable />

      <h2>6. How long we keep data</h2>
      <Table
        head={['Data', 'Retention']}
        rows={[
          ['Technical data and security logs', 'Up to 90 days'],
          ['Analytics data', 'As set by the provider listed in the Cookie Policy, typically up to 14 months'],
          ['Correspondence', 'Up to 24 months after the last message'],
          [
            'Your consent choice',
            'Stored only in your browser, in the cookie described in the Cookie Policy; we do not keep a copy',
          ],
        ]}
      />

      <h2>7. Your rights</h2>
      <p>
        Depending on where you live you have the right to access, correct, delete, or receive a copy of your
        personal data, to restrict or object to certain processing, and to withdraw consent at any time
        without affecting processing that happened before. Write to {mail} to exercise them; we respond within
        one month (extendable in complex cases as the law allows). You also have the right to lodge a
        complaint with your data protection authority; in Croatia that is the Personal Data Protection Agency
        (AZOP).
      </p>

      <h2>8. Security</h2>
      <p>
        We protect personal data with technical and organisational measures appropriate to the risk,
        including encryption in transit and access controls. No system is perfectly secure; if you suspect a
        problem, contact us immediately.
      </p>

      <h2>9. Children</h2>
      <p>
        The Site is not directed at children under 16 and we do not knowingly collect their data. If you
        believe a child has provided us data, contact us and we will delete it.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy. The effective date at the top is updated when we do. Where a change affects
        consent-based processing, we will ask for your consent again.
      </p>

      <h2>11. Contact</h2>
      <p>Questions about this policy or your data: {mail}.</p>
    </LegalPage>
  )
}
