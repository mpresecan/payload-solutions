# Legal audit for Payload Consent — design record

| | |
| --- | --- |
| Scope | `payload-consent` CLI + MCP server + legal skill, inside `@payload-solutions/plugin-consent` |
| Status | Implemented, 7 September 2026 |
| Related | `notes/plugin-consent-spec.md` (§2 listed "generating the privacy policy from a data-processing model" as a v1 non-goal — this reaches the useful part of that by deriving the model instead of asking for it) |

---

## 1. The idea

Not "AI writes your privacy policy". A **compliance diff engine**: derive facts from the project
(code, dependencies, environment, Payload schema, the plugin's own registers), extract claims
from the legal prose, and report where they disagree.

The model does exactly two things code cannot: read prose and judge whether it says something,
and draft prose in the right register and language. Everything else is deterministic.

## 2. Decisions

| Decision | Why |
| --- | --- |
| Deterministic engine and model judgement are separated, and every finding is tagged `deterministic` or `inferred` | Legal output loses its credibility the moment a model asserts something a script could have proved. It also makes the scan valuable with no model at all. |
| Inferred findings must carry a quote | It is what makes a judgement checkable by a human in ten seconds. `consent_report` rejects those without one. |
| Bring-your-own-agent over MCP; **no model code in the package** | No API keys, no inference cost, no provider churn, and the customer's legal text never passes through a vendor they did not choose. "Model-agnostic" as the absence of a wrapper. |
| A `payload-consent` bin inside the plugin, not a separate package | The plugin already owns the registers and the page format; a second package would be a second release surface for one command. |
| Markdown is the agent's edit format, tokens and all | The legal-pages editor already registers the markdown transformer, and the seed templates are already markdown with `{{…}}` tokens. The agent reads and writes exactly the format the documents were authored in, and no converter has to be kept in step. |
| Unknowns are asked in the terminal, not guessed | The agent is already in a session with a person, so the interview needs no mechanism. |
| The never-invent rule is a **validation error**, not skill prose | `consent_propose` refuses any draft whose checklist depends on an unanswered profile question. A skill is a request; this is a refusal. |
| The report is also stored in Payload, admin-only | The person who fixes "no retention period stated" is usually not the person with a terminal. Read access is `access.manage`, deliberately unlike legal pages, which are public. |
| Acceptance lives on the stored finding with a **required reason**, not in a repo ignore file | One source of truth, owned by the person making the decision, and the record doubles as a dated accepted-risk trail. Editors cannot edit a JSON file in a repo. |
| Environment detection reads the project's `.env*` files, never `process.env` | Caught during testing: the container's own `AWS_*` and `ANTHROPIC_*` variables surfaced as recipients. A missed detection is a warning that never fires; an ambient one is a false accusation in a legal document. |
| Detections are stored as the **vendor**, never the variable name | A stored audit is not the place for an inventory of someone's infrastructure. |
| Consent records are hard-excluded from everything | They are real personal data. No tool exposes them and the data map marks the collection excluded. |
| No static (no-DB) scan | Code facts with no claims to check them against are facts, not findings, and noise in a compliance tool teaches people to ignore it. The scan needs a database but not published pages — pre-launch is its best moment. |

## 3. Shape

```
bin.js                     tsx launcher, mirroring payload's own bin (incl. the registerHooks
                           workaround); resolves tsx through `payload` because pnpm does not
                           hoist it
src/cli/
  index.ts                 init | scan | mcp | apply | profile
  mcp.ts                   hand-rolled stdio JSON-RPC, 10 tools, skill served as a resource
  init.ts                  .mcp.json / .cursor/mcp.json, skill install, AGENTS.md, .gitignore
  load.ts                  findConfig + getPayload + getPluginOptions
src/audit/
  types.ts                 Finding, ScanResult, ProjectFacts, ComplianceProfile
  findings.ts              the taxonomy; severity and source come from the code, not the caller
  scan.ts                  the deterministic engine + carryForward of acceptances
  project.ts               deps, env names, Payload schema → vendors and personal-data map
  profile.ts               the questions, and recording answers with provenance
  checklists.ts            requirements per page kind, terminology and false friends per language
  markdown.ts              lexical ↔ markdown with token preservation
  proposals.ts             validate (incl. the needs-input gate), diff, apply as drafts
  report.ts                markdown and console renderers, --fail-on
  store.ts                 read/write the consent-audits collection
src/collections/audits.ts  admin-only stored audits with per-finding acceptance
src/globals/compliance.ts  the Compliance profile tab
src/skill/                 SKILL.md + 7 references, copied into the project by `init`
```

`consentPlugin({ audits })` adds the collection; the slug is configurable like the others.

## 4. Finding taxonomy

Codes are stable API — they appear in reports, stored audits and acceptance records.

Deterministic: `seed/unresolved-token`, `seed/placeholder-text`, `seed/review-banner`,
`registry/unverified-processor`, `registry/undisclosed-vendor`,
`registry/transfer-without-mechanism`, `registry/no-recipients-table`,
`registry/no-transfers-table`, `registry/no-subprocessor-table`, `registry/no-annex`,
`trackers/no-cookie-table`, `trackers/missing-duration`, `trackers/missing-purpose`,
`trackers/uncategorised`, `pages/missing-kind`, `pages/unpublished`,
`pages/stale-effective-date`, `pages/missing-locale`, `pages/locale-diverged`,
`pages/duplicate-kind`, `banner/missing-link`, `banner/link-unpublished`,
`banner/reject-all-off`, `settings/recording-off-with-optin`, `datamap/undisclosed-category`,
`profile/needs-input`.

Inferred (agent only): `art13/missing-disclosure`, `art13/vague-disclosure`,
`art28/missing-clause`, `eprivacy/missing-disclosure`, `contradiction/page-vs-registry`,
`contradiction/page-vs-page`, `language/register`, `clarity/plain-language`.

Ids are `code#hash(subject)` — stable across runs, which is what lets acceptances carry forward.

## 5. The skill

`SKILL.md` plus references for Art. 13/14, Art. 28, ePrivacy, Chapter V transfers, US state law,
the interview technique, and per-language terminology. Installed into `.claude/skills/` by
`init`, referenced from `AGENTS.md` for agents that do not read skills, and served over MCP as
`payload-consent://skill` for those that read neither.

Three rules, in order: deterministic first; never invent a legal fact; respect the language.

## 6. Verified

Cloud container, against the dev app: typecheck, `pnpm build` (53 files, skill markdown copied
into `dist/`), 58 integration tests (19 existing + 39 new). End to end: `node bin.js scan`
against the dev database produces 24 blockers and 10 warnings on the deliberately unconfigured
seed data; `node bin.js mcp` completes an MCP handshake with clean stdout (Payload's pino output
is redirected to stderr so it cannot corrupt the JSON-RPC stream); `node bin.js init` writes the
MCP entry, the skill and AGENTS.md into a fresh project.

Tests worth keeping: the markdown round trip preserves block tokens in both directions; env
parsing never picks up the ambient environment; a proposal is refused while its facts are
unanswered and accepted once they are; applying leaves the published document untouched and the
change in a draft version; the audits collection denies anonymous reads while legal pages allow
them; accepting a finding without a reason fails validation.

## 7. Deliberately absent

- Any AI SDK, provider registry or `--model` flag. A headless CI path can be added later if
  someone asks; it is not needed while a human's agent is the consumer.
- Publishing. No path exists from an agent to a published document.
- A static, database-free scan. See §2.
- A repo-side ignore file. Acceptance is a Payload record.

## 8. Open

- A dashboard widget showing the last audit's counts next to the existing `ConsentOverview`.
- A `.consent/snapshot.json` for database-free CI, only if the demand appears.
- Whether `consent_report` should also mark previously-open findings as `fixed` when they stop
  being raised, rather than simply omitting them.
