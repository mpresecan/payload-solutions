import type { CompanyInfo } from '../../types.js'
import { NOT_LEGAL_ADVICE, contactBlock, formatDate, jurisdictionsText } from './shared.js'

/**
 * A concise privacy policy structured after GDPR Articles 13/14 and the UK GDPR, with the
 * disclosures a SaaS or content site typically needs. Bracketed items are for the editor to confirm.
 * For an exhaustive attorney template covering US state laws see General Legal's
 * "Privacy Policy (GDPR enhanced)" (CC0): https://github.com/General-Legal/legal-templates
 */
export function privacyPolicyMarkdown(company: CompanyInfo, effectiveDate: string): string {
  const name = company.name
  const legal = company.legalName
  const dpoLine =
    company.dpo && typeof company.dpo === 'object'
      ? `We have appointed a Data Protection Officer. You can reach them at ${company.dpo.email}.`
      : 'We have not appointed a Data Protection Officer because we are not required to; the contact above handles all privacy requests.'

  return `${NOT_LEGAL_ADVICE}

Effective ${formatDate(effectiveDate)}.

{{policy-version}}

## 1. Who we are

${legal} ("${name}", "we", "us") is the controller of the personal data described in this policy. Our contact details:

${contactBlock(company)}

${dpoLine}

## 2. What we collect and why

| Category | Examples | Purpose | Legal basis |
| --- | --- | --- | --- |
| Account data | name, email address, password hash, profile settings | Create and secure your account, provide the service | Contract (GDPR Art. 6(1)(b)) |
| Organisation data | organisation name, membership, roles, invitations | Run shared workspaces you belong to | Contract |
| Billing data | plan, invoices, payment status (card details are held by our payment provider, not by us) | Bill subscriptions, keep accounting records | Contract; legal obligation (tax law) |
| Usage and technical data | IP address, browser and device information, pages visited, security logs | Keep the service secure, prevent abuse, fix problems | Legitimate interests (running a secure service) |
| Analytics data | aggregated interaction data, only when you allow analytics cookies | Understand how the service is used and improve it | Consent (Art. 6(1)(a)), withdrawable at any time |
| Support data | messages you send us and related account details | Answer your requests | Contract; legitimate interests |
| Marketing preferences | email opt-ins, newsletter engagement | Send information you asked for | Consent |

[Add or remove rows so the table matches what ${name} actually processes.]

We do not sell personal data. We do not use personal data to make automated decisions that have legal or similarly significant effects on you.

## 3. Cookies and similar technologies

We use cookies and comparable technologies. Necessary ones keep the service working; others run only with your consent, which you can give or withdraw at any time through the "Cookie settings" link in the footer. The full list, with providers and durations, is in our [Cookie Policy](/legal/cookies).

## 4. Who receives your data

We share personal data with the providers below. Processors act only on our instructions, under a written contract that binds them to confidentiality and appropriate security. A small number act as independent controllers for their own regulated purposes — payment providers, for example, which have their own anti-fraud and anti-money-laundering duties.

{{processor-table:recipients}}

We may also disclose personal data when the law requires it, to establish or defend legal claims, or to a buyer as part of a merger or acquisition — in which case this policy continues to apply until you are told otherwise. We do not sell personal data.

## 5. International transfers

Some of these providers process data outside ${jurisdictionsText(company)}. Every such transfer rests on one of the safeguards in Chapter V of the GDPR, listed per provider below. You can ask us for a copy of the Standard Contractual Clauses we rely on at ${company.email}.

{{processor-table:transfers}}

Where a transfer rests on an adequacy decision, we also keep Standard Contractual Clauses on file as a fallback, so a transfer does not have to stop if that decision is annulled.

## 6. How long we keep data

| Data | Retention |
| --- | --- |
| Account and organisation data | Until you delete your account or organisation, then up to 30 days in backups |
| Billing records | As long as tax and accounting law requires (typically 7–10 years) |
| Security and technical logs | Up to 90 days |
| Analytics data | As set by the provider listed in the Cookie Policy, typically up to 14 months |
| Support conversations | Up to 24 months after the last message |
| Consent records | Up to 36 months, as proof of your choices |

## 7. Your rights

Depending on where you live you have the right to access, correct, delete, or receive a copy of your personal data, to restrict or object to certain processing, and to withdraw consent at any time without affecting processing that happened before. Write to ${company.email} to exercise them; we respond within one month (extendable in complex cases as the law allows). You also have the right to lodge a complaint with your data protection authority.

[If you offer California or other US-state rights, add the relevant notice here.]

## 8. Security

We protect personal data with technical and organisational measures appropriate to the risk, including encryption in transit, access controls, and logging. No system is perfectly secure; if you suspect a problem with your account, contact us immediately.

## 9. Children

The service is not directed at children under 16 [adjust to your legal age threshold] and we do not knowingly collect their data. If you believe a child has provided us data, contact us and we will delete it.

## 10. Changes to this policy

We may update this policy. Material changes are announced in the service or by email, and the effective date at the top is updated. Where a change affects consent-based processing, we will ask for your consent again.

## 11. Contact

Questions about this policy or your data: ${company.email}.
`
}
