import type { CompanyInfo } from '../../types.js'
import { NOT_LEGAL_ADVICE, contactBlock, formatDate } from './shared.js'

/**
 * Terms of Service following the Common Paper model: a cover page of business terms that
 * incorporates the Common Paper Cloud Service Agreement Standard Terms by reference.
 * Common Paper agreements are licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/);
 * the attribution below must stay in the published document.
 * Standard Terms: https://commonpaper.com/standards/cloud-service-agreement/2.1
 */
export function termsOfServiceMarkdown(company: CompanyInfo, effectiveDate: string): string {
  const provider = company.legalName
  const product = company.name
  const law = company.governingLaw ?? '[Governing law, e.g. Ireland]'

  return `${NOT_LEGAL_ADVICE}

Effective ${formatDate(effectiveDate)}.

These Terms of Service ("Terms") are an agreement between ${provider} ("Provider") and the customer accepting them ("Customer") for the use of ${product} (the "Product"). By creating an account, clicking to accept, or using the Product, Customer agrees to these Terms. If you accept on behalf of an organisation, you confirm you have authority to bind it.

These Terms consist of this Cover Page and the **Common Paper Cloud Service Agreement Standard Terms, Version 2.1**, which are incorporated by reference and available at [commonpaper.com/standards/cloud-service-agreement/2.1](https://commonpaper.com/standards/cloud-service-agreement/2.1). If the Cover Page and the Standard Terms conflict, the Cover Page controls.

## Cover Page

### Key terms

| Term | Value |
| --- | --- |
| Provider | ${provider} |
| Product | ${product} — the cloud service described at ${company.url ?? '[product URL]'} and its documentation |
| Effective Date | The date Customer first accepts these Terms |
| Governing Law | ${law} |
| Chosen Courts | The courts of ${law} |
| Provider Notice Address | ${company.email} |
| DPA | The Data Processing Agreement published at [/legal/dpa](/legal/dpa), if any, is incorporated by reference |
| Security Policy | [Link to your security page, or "as described in the documentation"] |
| Insurance | [None / describe] |

### Order Form terms

| Term | Value |
| --- | --- |
| Subscription Period | The billing period selected at checkout (monthly or yearly), renewing automatically until cancelled |
| Non-Renewal Notice Date | Cancel from billing settings any time before the end of the current Subscription Period |
| Fees | As shown on the pricing page and at checkout for the selected plan and seats; excluding taxes |
| Payment Process | Automatic payment by card through our payment provider, in advance for each Subscription Period; usage-based fees, if any, in arrears |
| Technical Support | Email support at ${company.email} during business hours [adjust to your plans] |
| Use Limitations | The seat, storage and feature limits of the selected plan |
| Cloud Service | ${product} |
| Software | Any client software or APIs made available with the Product |
| Documentation | The documentation published at ${company.url ?? '[docs URL]'} |

### Modifications to the Standard Terms

[None.] [Or list any clauses of the Standard Terms that are changed for this Product.]

### Additional terms

- **Free plans and trials.** Free or trial use is provided "as is" and may be limited, suspended or ended at any time.
- **Refunds.** Fees are non-refundable except as required by law or expressly stated in the Standard Terms.
- **Changes.** Provider may update these Terms; material changes are announced at least 30 days before they take effect, and continued use after that date is acceptance.
- **Consumers.** If Customer is a consumer under applicable law, mandatory consumer protections apply and nothing in these Terms limits them.

## Contact

${contactBlock(company)}

---

*The Standard Terms are the Common Paper Cloud Service Agreement v2.1, © Common Paper, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This Cover Page is an adaptation prepared by ${provider}.*
`
}
