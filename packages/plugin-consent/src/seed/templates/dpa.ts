import type { CompanyInfo } from '../../types.js'
import { NOT_LEGAL_ADVICE, contactBlock, formatDate, jurisdictionsText } from './shared.js'

/**
 * A Data Processing Agreement for the case where **you are the processor** and your business
 * customers are the controllers — GDPR Art. 28(3). Modelled on the Common Paper Data Processing
 * Agreement (CC BY 4.0, https://commonpaper.com/standards/data-processing-agreement/) and the
 * annex structure of the EU Standard Contractual Clauses (Implementing Decision 2021/914).
 *
 * The DPA you need with *your own* vendors is a different document, and it is theirs to provide.
 */
export function dpaMarkdown(company: CompanyInfo, effectiveDate: string): string {
  const name = company.name
  const legal = company.legalName

  return `${NOT_LEGAL_ADVICE} A DPA is a contract that creates real obligations and a real liability position. Have a lawyer read this one before you offer it to customers.

Effective ${formatDate(effectiveDate)}.

{{policy-version}}

This Data Processing Agreement ("DPA") forms part of the agreement between ${legal} ("Provider", "we") and the customer ("Customer", "you") for the use of ${name} (the "Agreement"). It applies where we process personal data on your behalf. Capitalised terms not defined here have the meaning given in the GDPR or in the Agreement.

## Cover page

| Term | Value |
| --- | --- |
| Provider | ${legal}, ${company.address} |
| Agreement | The Terms of Service at ${company.url ?? '[your terms URL]'} |
| Approved sub-processors | The list published at ${company.url ?? ''}/legal/subprocessors, as updated from time to time |
| Sub-processor change notice | [30] days before the sub-processor begins processing |
| Security contact | ${company.dpo && typeof company.dpo === 'object' ? company.dpo.email : company.email} |
| Security policy | [Link to your security page, or "Annex II below"] |
| DPA liability cap | [As set out in the Agreement] |
| Governing law and courts | ${company.governingLaw ?? '[Governing law]'} |
| Restricted transfers | Standard Contractual Clauses, governing Member State [Ireland] |

## 1. Roles and scope

You are the controller and we are the processor for customer personal data processed through the service. Where you are yourself a processor for a third party, we are a sub-processor and this DPA applies as if references to controller were to that third party. We process customer personal data only on your documented instructions, which the Agreement and your use of the service constitute, unless required otherwise by law — in which case we tell you first, unless the law forbids it.

## 2. Processing

Annex I describes the subject matter, duration, nature, purpose, categories of data subject and categories of personal data. We ensure that everyone authorised to process customer personal data is bound by confidentiality. We implement the technical and organisational measures in Annex II, and we do not sell customer personal data or use it for our own purposes, including training machine learning models, unless you instruct us to.

## 3. Sub-processors

You give general written authorisation for us to engage the sub-processors listed in Annex III. We impose data protection obligations on each of them that are no less protective than this DPA, and we remain fully liable to you for their performance. We announce intended additions on the sub-processors page with the notice period on the cover page. You may object on reasonable data protection grounds within that period; if we cannot offer a workable alternative, you may terminate the affected part of the subscription without penalty.

## 4. International transfers

Where processing takes place outside ${jurisdictionsText(company)}, it rests on an adequacy decision or on the Standard Contractual Clauses, which are incorporated into this DPA by reference and completed by Annexes I and II. Where an adequacy decision is annulled or suspended, the Standard Contractual Clauses apply from that date without further action by either party. For UK personal data the International Data Transfer Addendum applies; for Swiss personal data, the FDPIC-approved variant.

## 5. Security incidents

We notify you without undue delay, and in any case within [48] hours, of becoming aware of a personal data breach affecting customer personal data. The notice describes the nature of the breach, the categories and approximate number of data subjects and records affected as far as known, the likely consequences and the measures taken. We assist you with your own notification duties under Articles 33 and 34.

## 6. Assistance

Taking into account the nature of the processing, we assist you with data subject requests, with data protection impact assessments and with prior consultation of a supervisory authority. The service provides self-service export and deletion; where a request cannot be handled through those, we help you within a reasonable time.

## 7. Audit

We make available the information necessary to demonstrate compliance with Article 28, including our current certifications and third-party reports where we hold them. You may audit once in any twelve-month period, on [30] days' notice, during business hours, subject to confidentiality, at your cost, and without access to other customers' data — or more often where a supervisory authority requires it or following a personal data breach.

## 8. Deletion and return

On termination we delete customer personal data within [30] days, or return it if you ask before that period ends, except where storage is required by law. Backups are deleted on their ordinary cycle, and remain subject to this DPA until they are.

## 9. Liability, conflicts and term

Each party's liability under this DPA is subject to the limitations in the Agreement. Where this DPA conflicts with the Agreement, this DPA prevails on data protection matters; where it conflicts with the Standard Contractual Clauses, the Clauses prevail. This DPA takes effect with the Agreement and ends when we have deleted or returned all customer personal data.

## Annex I — Description of the processing

**A. Parties.** Data exporter: the Customer, acting as controller. Data importer: ${legal}, acting as processor, ${company.address}, ${company.email}.

**B. Description.**

| | |
| --- | --- |
| Subject matter | Provision of ${name} under the Agreement |
| Duration | The term of the Agreement, plus the deletion period in clause 8 |
| Nature and purpose | Hosting, storage, transmission and display of customer content; account administration; support; security and abuse prevention |
| Categories of data subject | The Customer's users, and any individuals whose personal data the Customer submits |
| Categories of personal data | [Confirm against Annex III and your product: identity and contact data, account credentials, customer content, usage and technical data] |
| Special category data | [None, unless the Customer submits it. If your product handles it, describe the additional safeguards here.] |
| Frequency | Continuous, for the duration of the Agreement |
| Retention | As set out in the Agreement and clause 8 |

**C. Competent supervisory authority.** [The supervisory authority of the Member State in which the data exporter is established, or its EU representative.]

## Annex II — Technical and organisational measures

[Replace this list with what you actually do. An inaccurate Annex II is worse than a short one — it is a contractual representation.]

- Encryption of customer personal data in transit (TLS 1.2+) and at rest.
- Role-based access control, unique accounts, and multi-factor authentication for administrative access.
- Access to production data restricted to staff who need it, logged and reviewed [quarterly].
- Segregation of customer data by tenant identifier, enforced in the application layer.
- Backups taken [daily], encrypted, with restore tested [annually].
- Vulnerability management: dependency scanning on every build, patching of critical issues within [7] days.
- Change management: peer-reviewed code, automated tests, and staged deployment.
- Security incident response plan with defined roles and the notification timeline in clause 5.
- Personnel: confidentiality undertakings, background checks where lawful, security training on joining and [annually].
- Sub-processor due diligence before engagement and on [annual] review.
- Business continuity and disaster recovery objectives: RPO [24 hours], RTO [24 hours].

## Annex III — Sub-processors

The current list, maintained at [/legal/subprocessors](/legal/subprocessors):

{{processor-table:annex}}

## Contact

${contactBlock(company)}
`
}
