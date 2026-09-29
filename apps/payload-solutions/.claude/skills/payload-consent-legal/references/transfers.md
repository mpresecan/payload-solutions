# International transfers: Chapter V

Any personal data leaving the EEA needs a basis in Chapter V, on top of the ordinary Art. 6
basis. For a typical Payload project this is not exotic: the host, the error tracker, the email
provider and the analytics vendor are frequently US companies.

## The mechanisms

**Adequacy decision — Art. 45.** The Commission has decided a country protects data adequately.
Nothing further is needed. The list changes; check it rather than reciting one from memory.

**EU–US Data Privacy Framework — Art. 45.** An adequacy decision limited to US organisations
that self-certify. Two things follow. First, it only covers the *certified entity* — the
contracting entity has to be on the list, and vendors contract through several. Second, its
predecessors were both struck down, which is why the processor register carries a `fallback`
field: name the SCCs as what applies if the decision falls.

**Standard Contractual Clauses — Art. 46(2)(c).** The 2021 modules. Pick the module that matches
the relationship (controller-to-processor is Module Two). For UK data, the SCCs plus the UK
International Data Transfer Addendum, or the UK IDTA on its own.

**Binding Corporate Rules — Art. 47.** Intra-group, approved by an authority. Rare outside large
groups.

**Derogations — Art. 49.** Explicit consent, contractual necessity, and so on. Occasional and
non-repetitive by design. A derogation relied on for routine infrastructure is a finding.

## Transfer impact assessments

Where SCCs are relied on, *Schrems II* requires assessing whether the destination's law
undermines them, and adding supplementary measures where it does — encryption with keys held in
the EEA, pseudonymisation, EU-only processing regions.

A privacy policy does not have to publish the assessment. It does have to name the mechanism and
say how to get a copy of the safeguards. If the DPA claims SCCs and there is no assessment
anywhere, that is worth a warning, phrased as what is missing rather than as advice.

## What to check in the documents

- Every non-EEA recipient in the register has a mechanism. The scan raises
  `registry/transfer-without-mechanism` when one does not — that half is already proved.
- The privacy policy renders a transfers table (`{{processor-table:transfers}}`) rather than a
  sentence saying transfers "may" occur.
- The policy says how to obtain a copy of the safeguards, and the route works.
- Where DPF is claimed, the *contracting entity* is the certified one — not the parent company.
- Where a vendor offers EU-region processing and the project uses it, the register says the
  country is in the EEA and the policy does not still describe a US transfer.
- The DPA incorporates the SCCs with the modules identified, where relevant.

## A note on tone

"Your data is safe because we use Standard Contractual Clauses" is a claim about outcomes.
"Where we transfer data outside the EEA we rely on the Standard Contractual Clauses; you can
request a copy at [address]" is a disclosure. Prefer the second, and raise the first as
`art13/vague-disclosure` when it stands in for the mechanism.
