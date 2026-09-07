import type { CompanyInfo } from '../../types.js'
import { NOT_LEGAL_ADVICE, contactBlock, formatDate } from './shared.js'

/**
 * The public sub-processor list. Not a statutory publishing duty in itself — it exists because
 * GDPR Art. 28(2) lets a processor engage sub-processors only with the controller's authorisation,
 * and general written authorisation obliges you to announce changes and allow objection. Every DPA
 * you sign will assume a page like this one.
 */
export function subprocessorsMarkdown(company: CompanyInfo, effectiveDate: string): string {
  const name = company.name
  const legal = company.legalName

  return `${NOT_LEGAL_ADVICE}

Last updated ${formatDate(effectiveDate)}.

{{policy-version}}

## What this page is

When you use ${name}, ${legal} processes personal data on your behalf under our [Data Processing Agreement](/legal/dpa). To run the service we engage other companies — sub-processors — who may process that data too. This page is the current, authoritative list.

If you are an individual rather than a customer, the providers that handle your own data are listed in our [Privacy Policy](/legal/privacy).

## Current sub-processors

{{processor-table:subprocessors}}

Each of these is bound by a written agreement that imposes data protection obligations no less protective than the ones we owe you, including confidentiality, security measures and assistance with data subject requests.

## Changes and your right to object

We give customers advance notice before a new sub-processor starts processing customer personal data. During that notice period you may object on reasonable data protection grounds. If we cannot resolve the objection, you may terminate the affected subscription without penalty for the remainder of its term.

Notice is published on this page, and the version identifier above changes whenever the list does. To object, or to ask to be notified by email when the list changes, write to us at ${company.email}.

## Recent changes

{{processor-table:changes}}

## Infrastructure and regions

[Describe where your own infrastructure runs — the regions, and whether customers can choose one. Remove this section if it does not apply.]

## Contact

${contactBlock(company)}
`
}
