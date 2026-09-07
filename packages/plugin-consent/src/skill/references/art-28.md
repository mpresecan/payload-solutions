# The DPA: Article 28

A data processing agreement is what a controller must have in place before a processor touches
their data. Art. 28(3) lists eight things the contract must contain. They are cumulative: a
document missing one of them is not a DPA, however long it is.

If the project sells to businesses, its customers will ask for this before they sign. If the
project *is* the customer, the same list is what to check in someone else's DPA.

## The eight clauses

**(a) Documented instructions.** The processor processes only on the controller's documented
instructions, including for transfers to a third country, unless required by law — in which case
it tells the controller first, unless the law forbids that.

**(b) Confidentiality.** Persons authorised to process are under a confidentiality obligation,
contractual or statutory.

**(c) Security.** The Art. 32 measures. A commitment plus a description concrete enough to be
assessed — normally Annex II. "Industry-standard security" is not a measure.

**(d) Sub-processors.** Read with 28(2) and 28(4): no sub-processor without authorisation
(specific or general with notice and a right to object), and the same obligations flowed down by
contract. The processor stays liable for its sub-processors.

**(e) Assistance with data subject rights.** Appropriate technical and organisational measures to
help the controller answer requests, taking account of the nature of processing.

**(f) Assistance with Articles 32 to 36.** Security, breach notification, impact assessments and
prior consultation, taking account of the nature of processing and the information available.

**(g) Deletion or return.** At the controller's choice, at the end of the service, plus deletion
of copies — unless storage is required by law. A DPA where the processor picks is defective.

**(h) Information and audits.** Making available the information needed to demonstrate
compliance, and allowing and contributing to audits and inspections. Restricting this to "an
annual SOC 2 report" is a negotiated position, not the Article; note the gap rather than
pretending it is met.

## The annexes

Standard practice, and required in substance where the SCCs are incorporated:

- **Annex I** — the parties, and a description of the processing: subject matter, duration,
  nature and purpose, categories of personal data, categories of data subject.
- **Annex II** — technical and organisational measures. Specific enough to be assessed:
  encryption in transit and at rest, access control, logging, backup and restore, personnel
  vetting, incident response. A list of adjectives is not Annex II.
- **Annex III** — sub-processors. Generate it from the register with
  `{{processor-table:annex}}` so the annex and the published list cannot disagree.

## Things to check that are not in the list

- **Breach notification timing.** Art. 33(2) says "without undue delay". A concrete period
  (24, 48, 72 hours) is what makes it operable. Note its absence as a warning.
- **The party names match the terms of service** and the controller named in the privacy policy.
  Three documents naming two entities is a real finding.
- **Deletion promises match the retention table.** A DPA promising deletion within 30 days next
  to a privacy policy keeping backups for a year is a contradiction, and a common one.
- **Liability and indemnity** are commercial terms, not Art. 28 items. Do not raise findings
  about them; they are the business's to negotiate.
- **International transfers.** If the processor is outside the EEA, the SCCs (with the UK
  Addendum where relevant) should be incorporated and the modules identified. See
  `transfers.md`.

## When the project is the processor

If `role` is `processor` or `both`, the DPA is a document the project *offers*, and the
sub-processor page is a promise it keeps. Check that the notice period on the page matches the
one in the DPA, and that the objection route actually exists.
