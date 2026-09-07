# US state privacy laws

Only relevant when the compliance profile lists US states. If it does not, do not add US
sections to an EEA policy — a policy padded with rights nobody in its audience has is harder to
read, and Art. 12(1) is a requirement.

The shape is different from the GDPR in a way that matters for the documents: these are
**opt-out** regimes. Processing is permitted by default and the person can say stop. That is why
the plugin resolves a different consent model for US visitors, and why a single global banner
that demands opt-in everywhere is usually wrong in both directions.

## California (CCPA as amended by CPRA)

The most demanding, and the one whose vocabulary the others borrowed.

- **"Sale" and "sharing"** are broad. Sharing includes disclosing personal information for
  cross-context behavioural advertising, with or without money. A site running an advertising
  pixel is very likely "sharing".
- **A "Do Not Sell or Share My Personal Information" link** must be available where selling or
  sharing happens.
- **Global Privacy Control** must be honoured as a valid opt-out signal. The plugin honours GPC
  per category; check the policy says so.
- **Sensitive personal information** has a separate right to limit its use.
- **Notice at collection**: categories collected, purposes, retention, and whether sold or
  shared — at or before the point of collection.
- **Rights**: know, delete, correct, opt out, limit sensitive use, and non-discrimination for
  exercising them.

## The others

Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana and a growing list follow a
similar pattern with local variations: opt-out of targeted advertising and sale, access,
deletion, correction, portability, an appeals process in several, and opt-in for sensitive data
in most — which is stricter than California on that specific point.

Do not enumerate every state's rights in the policy. A section that states the rights and says
which states they apply in is more readable and more accurate than fifty near-duplicates.

## What to check

- The policy has a US section at all, if the profile lists US states.
- "We do not sell your personal information" — is that actually true given the advertising and
  analytics trackers in the register? This is a `contradiction/page-vs-registry` finding and a
  common one, because the definition of "sale" is much broader than an exchange of money.
- GPC is mentioned and honoured.
- Sensitive information is addressed where the data map shows any.
- The notice-at-collection content exists somewhere the person sees before or at collection.
- The EEA and US sections do not contradict each other about the same processing.

## What not to do

Do not translate GDPR language into a US section — "legal basis" and "data subject" are not
concepts these laws use, and their presence is a sign the section was copied rather than
written. Equally, do not let US vocabulary leak into the EEA section: the EEA question is not
whether you sell data, it is what your basis is.
