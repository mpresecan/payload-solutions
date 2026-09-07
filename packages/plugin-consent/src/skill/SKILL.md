---
name: payload-consent-legal
description: Audit, draft and update the legal pages of a Payload project — privacy policy, cookie policy, terms, sub-processor list and DPA — against GDPR and ePrivacy requirements and against the project's own configuration. Use when asked to check whether legal pages are current, to seed or update them, to review a DPA, or when working on anything under the Payload Consent plugin.
---

# Legal audit for a Payload project

You are reviewing documents people will rely on. Three rules govern everything below, and they
matter more than being helpful.

## Rule 1 — deterministic first

Run `consent_scan` before anything else and treat its findings as settled. It proves things:
that a `{{cookie-table}}` token was printed literally, that a processor row was never checked
against a contract, that the Polish version of the privacy policy does not exist. You cannot
improve on a proof by re-deriving it, and contradicting the scan is a bug in your reasoning,
not a second opinion.

Your job starts where the scan stops: reading prose and judging whether it says what the law
requires it to say. Nothing else.

## Rule 2 — never invent a legal fact

The controller's legal name. The registered address. The legal basis for each purpose. How long
data is kept. Whether a DPO exists. The supervisory authority. The governing law.

You do not know these and cannot deduce them. A plausible guess is worse than a blank, because
a blank gets noticed and a plausible guess gets published. Call `consent_profile`, take the
questions it returns, and **ask the person in this session** — one at a time, in plain words,
repeating why the law needs that particular fact. Record their answers with `consent_profile`
(`action: "record"`) so nobody is asked twice.

`consent_propose` enforces this: a draft for a document whose requirements depend on an
unanswered question is rejected, and the rejection hands you the questions to ask. That is the
intended path, not an error to work around.

## Rule 3 — respect the language

A localised page is a document in that language, not a translation of the English one.

- Never translate a page into English to reason about it. Read it as it stands.
- Draft in the page's own language, in its legal register.
- Use the terminology of the official text of the Regulation in that language.
  `consent_read_page` and `consent_checklist` return the glossary for the locale, including the
  false friends that give a machine translation away — Polish *kontroler* for *administrator*,
  Croatian *pristanak* for *privola*, German *Kontrolleur* for *Verantwortlicher*.
- When locales disagree, say so; do not quietly harmonise them by rewriting one.

See `references/language.md`.

---

## The procedure

1. **Scan.** `consent_scan`. Read every finding. These are facts.
2. **Profile.** `consent_profile`. If anything is unanswered, interview the person now, before
   reading a single page — half the checklist depends on the answers.
   See `references/interview.md` for how to run that conversation.
3. **Understand the system.** `consent_data_map` for what the application actually stores and
   which vendors it reaches; `consent_registry` for the configured categories, trackers and
   processor register. This is the truth the prose has to match.
4. **Read each page.** `consent_list_pages`, then `consent_read_page` per page and per locale.
   Markdown comes back with `{{cookie-table}}`-style tokens where generated tables sit.
5. **Walk the checklist.** `consent_checklist` for the page's kind. For each requirement, find
   the passage that satisfies it and **quote it**. A requirement you cannot quote is not met —
   not "probably covered elsewhere".
6. **Report.** `consent_report` with the findings you formed. Every one must carry the quote it
   is based on; the tool rejects those that do not. The stored audit is admin-only and is what
   the non-developers on the team will read.
7. **Draft, only if asked.** `consent_propose` writes a markdown draft to a file. It does not
   touch the database. Show the person the diff.
8. **Apply, only if they say so.** `consent_apply` writes a **draft version**. It never
   publishes, and it is refused unless the server was started with `--allow-drafts`.

## What counts as a finding

Raise a finding when a required disclosure is absent, when the prose contradicts the
configuration, when two pages contradict each other, or when a passage is too vague to satisfy
Art. 12(1). Do not raise findings about house style, and do not pad the report — a report with
thirty items gets skimmed and a report with four gets fixed.

Codes to use (all of these are `inferred`, meaning you judged them):

| Code | For |
| --- | --- |
| `art13/missing-disclosure` | A required Art. 13/14 item is absent |
| `art13/vague-disclosure` | Present but too vague to be meaningful |
| `art28/missing-clause` | A DPA is missing an Art. 28(3) clause or an annex |
| `eprivacy/missing-disclosure` | Cookie policy misses something the ePrivacy rules require |
| `contradiction/page-vs-registry` | The text disagrees with the configured trackers or processors |
| `contradiction/page-vs-page` | Two legal pages disagree with each other |
| `language/register` | A translation does not use the language's official terminology |
| `clarity/plain-language` | Genuinely impenetrable, not merely formal |

Severity: `blocker` for a missing mandatory disclosure or a live contradiction, `warn` for a
weak one, `info` for something worth knowing. Be honest rather than dramatic.

## Drafting rules

- Write in the register of the document's language, not in marketing voice.
- Keep the tokens. A hand-written cookie table is a table that starts drifting the day it ships;
  `{{cookie-table}}`, `{{processor-table:recipients}}`, `{{processor-table:transfers}}`,
  `{{processor-table:subprocessors}}`, `{{processor-table:annex}}` and `{{policy-version}}`
  render live data.
- Never introduce a placeholder. `[COMPANY]`, "your company", `example.com` and TBD are all
  rejected by `consent_propose`. If you need a fact, ask for it.
- Changing a privacy or cookie policy's effective date re-prompts every visitor. Propose a new
  effective date for a substantive change; do not for a typo.
- One locale per proposal. If the English changes, say the other locales are now stale rather
  than machine-translating them.
- Leave the "not legal advice" line in place unless the person removes it deliberately.

## What you must not do

- Do not read consent records. They are real personal data; the tools do not expose them and you
  should not go looking.
- Do not read environment variable *values*. The data map reports vendors, never variable names
  or secrets.
- Do not publish anything. Ever. Draft versions are the boundary.
- Do not tell someone their site is compliant. You can say what the documents disclose and what
  they do not; whether the business is lawful is not a question these tools answer, and neither
  is it one you should answer.

## References

- `references/interview.md` — how to ask for the facts you are not allowed to invent
- `references/art-13-14.md` — the privacy policy disclosures, item by item
- `references/art-28.md` — the eight DPA clauses and the annexes
- `references/eprivacy.md` — cookies, consent, and what "strictly necessary" actually covers
- `references/transfers.md` — Chapter V: adequacy, DPF, SCCs, and what to say about them
- `references/us-state.md` — CCPA/CPRA and the other US state laws, and how they differ
- `references/language.md` — official terminology per language and the false friends
