# Asking for the facts you are not allowed to invent

You are already in a terminal with a person. That is the whole mechanism — there is nothing to
build, you just have to actually ask, and ask well.

## How to ask

**One question at a time.** A wall of twelve questions gets one answer and eleven blanks.

**Say why.** The person is not a lawyer, and "enter retention period" means nothing to them.
The reason is what makes the question answerable:

> Article 13(2)(a) says a privacy policy has to give either a retention period or the criteria
> that decide it — "as long as necessary" on its own has been held not to satisfy it. So: how
> long do you keep an account after someone closes it?

**Accept the answer in their words.** If they say "until they ask us to delete it, and 90 days
of backups after that", record that. Do not translate it into legalese before storing it; the
drafting step can do that, and the record should show what they actually said.

**Take "I don't know" seriously.** It is a real answer and it means the document cannot be
written yet. Say which document is blocked, offer to come back to it, and move on to the parts
that are not blocked. Do not fill the gap with something reasonable-sounding.

**Do not accept an invitation to guess.** "Just put whatever's standard" is exactly the request
you refuse. Standard for whom? The answer decides what a regulator reads back to them.

## Recording

After each answer, call `consent_profile` with `action: "record"` and `{key, answer}`. Pass
`answeredBy` when you know who is speaking. The answer is stored on the compliance profile with
a timestamp, which does three things: the next run does not re-ask, `consent_propose` unblocks,
and a reviewer can see where the fact came from.

Record as you go, not in one batch at the end. A session that dies halfway should not lose six
answers.

## The questions, and what a good answer looks like

| Key | What you are really asking | A good answer |
| --- | --- | --- |
| `legalName` | The entity a data subject would write to or sue | "Fortbit d.o.o." — not the product name |
| `address` | Registered postal address | A real street address; an email alone fails Art. 13(1)(a) |
| `contactEmail` | Published privacy contact | A monitored address |
| `establishmentCountry` | Where the entity sits | An ISO code; decides the lead authority |
| `dpo` | Appointed or not | Either contact details, or a clear "no" — silence is not an answer |
| `audience` | B2B, B2C or both | Decides whether a DPA and sub-processor notices apply at all |
| `role` | Controller, processor, or both, **for customer data** | Get this right; backwards produces a document about someone else's business |
| `legalBases` | A basis per purpose | "accounts: contract; analytics: consent; fraud checks: legitimate interests (preventing chargebacks)" |
| `retention` | Period or criteria per purpose | "invoices: 5 years (tax law); logs: 30 days" |
| `dsrEmail` | Where access and deletion requests go | Often the same as the privacy contact; ask rather than assume |
| `supervisoryAuthority` | Where a complaint goes | Usually the authority of the establishment country |
| `automatedDecisions` | Profiling or automated decisions with legal effect | Usually "none" — but ask, do not assume |
| `governingLaw` | Law and forum for the terms | Only for the terms of service |

## When the answers conflict with the code

It happens: they say they keep nothing for more than 30 days, and the schema has a table of
invoices going back three years. Say so plainly, show the evidence from `consent_data_map`, and
let them resolve it. Do not silently prefer either one — the mismatch itself is the finding.
