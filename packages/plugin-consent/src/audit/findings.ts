import { shortHash } from '../versions.js'
import type { Finding, FindingSource, PageRef, Severity } from './types.js'

/**
 * The finding taxonomy. Codes are stable API: they appear in reports, in stored audits and
 * in acceptance records, so rename them only with a migration.
 *
 * `deterministic` codes are the ones the scan can prove on its own. `inferred` codes are the
 * ones only a reader of prose can raise; the scan never emits those, the agent does, and
 * `consent_report` rejects an inferred finding that arrives without a quote.
 */
export const FINDING_CODES = {
  // --- seeds and placeholders -------------------------------------------------
  'seed/unresolved-token': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Template token left in the page',
    fix: 'Replace the literal token with the matching block, or delete the paragraph.',
  },
  'seed/placeholder-text': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Seed placeholder was never filled in',
    fix: 'Replace the placeholder with your own details.',
  },
  'seed/review-banner': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Page still carries the "review before publishing" notice',
    fix: 'Remove the notice once the document has been reviewed, or keep it deliberately.',
  },

  // --- processor register -----------------------------------------------------
  'registry/unverified-processor': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Processor row was never checked against a contract',
    fix: 'Confirm the contracting entity and DPA link against the agreement you signed, then tick Verified.',
  },
  'registry/undisclosed-vendor': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Vendor detected in the project but not in the processor register',
    fix: 'Add the vendor to the register, or record why it never receives personal data.',
  },
  'registry/transfer-without-mechanism': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Transfer outside the EEA with no safeguard recorded',
    fix: 'Record the Chapter V mechanism (adequacy, DPF, SCC, BCR) for this recipient.',
  },
  'registry/no-recipients-table': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Recipients are disclosed in the register but not rendered in the privacy policy',
    fix: 'Add a {{processor-table:recipients}} block to the privacy policy.',
  },
  'registry/no-transfers-table': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Data leaves the EEA but the privacy policy renders no transfers table',
    fix: 'Add a {{processor-table:transfers}} block to the privacy policy.',
  },
  'registry/no-subprocessor-table': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Sub-processors are published but the page renders no list',
    fix: 'Add a {{processor-table:subprocessors}} block to the sub-processor page.',
  },
  'registry/no-annex': {
    severity: 'warn',
    source: 'deterministic',
    title: 'The DPA has no Annex III sub-processor table',
    fix: 'Add a {{processor-table:annex}} block to the DPA.',
  },

  // --- trackers and the cookie table -----------------------------------------
  'trackers/no-cookie-table': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Trackers are configured but the cookie policy renders no table',
    fix: 'Add a {{cookie-table}} block to the cookie policy so the table cannot drift from the trackers.',
  },
  'trackers/missing-duration': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Cookie has no stated duration',
    fix: 'Fill in the duration on the tracker; the cookie table publishes it verbatim.',
  },
  'trackers/missing-purpose': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Tracker has no purpose',
    fix: 'Describe what the tracker does; the text is shown in the preferences dialog and the cookie policy.',
  },
  'trackers/uncategorised': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Tracker has no category and will never load',
    fix: 'Assign the tracker to a consent category.',
  },

  // --- pages ------------------------------------------------------------------
  'pages/missing-kind': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'A required legal document does not exist',
    fix: 'Create the document, or turn the requirement off for this project.',
  },
  'pages/unpublished': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Legal page has never been published',
    fix: 'Publish the page; visitors cannot read a draft.',
  },
  'pages/stale-effective-date': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Page changed after its effective date',
    fix: 'Set a new effective date, which also re-prompts visitors when documents are a re-consent trigger.',
  },
  'pages/missing-locale': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'Legal page has no version in a configured locale',
    fix: 'Add the translation. Draft it in that language rather than translating the English wording literally.',
  },
  'pages/locale-diverged': {
    severity: 'warn',
    source: 'deterministic',
    title: 'Translations of the same page disagree on their effective date',
    fix: 'Bring the locales back into step; a visitor reading either one must get the same document.',
  },
  'pages/duplicate-kind': {
    severity: 'warn',
    source: 'deterministic',
    title: 'More than one published page of the same kind',
    fix: 'Keep one; the banner and the version hash can only point at one of them.',
  },

  // --- banner and settings ----------------------------------------------------
  'banner/missing-link': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'The banner does not link to a required policy',
    fix: 'Point the banner at the published page in Consent settings → Banner.',
  },
  'banner/link-unpublished': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'The banner links to a page that is not published',
    fix: 'Publish the linked page or point the banner at one that is.',
  },
  'banner/reject-all-off': {
    severity: 'blocker',
    source: 'deterministic',
    title: '"Reject all" is switched off while an opt-in jurisdiction is active',
    fix: 'Turn it back on. Refusing must be as easy as accepting (EDPB Guidelines 05/2020, §§ 39–41).',
  },
  'settings/recording-off-with-optin': {
    severity: 'info',
    source: 'deterministic',
    title: 'Consent is not recorded while an opt-in jurisdiction is active',
    fix: 'Consider anonymous recording; Art. 7(1) puts the burden of demonstrating consent on you.',
  },

  // --- data map ---------------------------------------------------------------
  'datamap/undisclosed-category': {
    severity: 'warn',
    source: 'deterministic',
    title: 'The application stores a category of personal data the register does not mention',
    fix: 'Check the privacy policy describes this category, and that some recipient row accounts for it.',
  },

  // --- profile ----------------------------------------------------------------
  'profile/needs-input': {
    severity: 'blocker',
    source: 'deterministic',
    title: 'A legal fact is missing and must come from a human',
    fix: 'Answer the question in the terminal; the answer is stored on the compliance profile.',
  },

  // --- inferred (raised by the agent, never by the scan) ----------------------
  'art13/missing-disclosure': { severity: 'blocker', source: 'inferred', title: 'Required Art. 13/14 disclosure is absent' },
  'art13/vague-disclosure': { severity: 'warn', source: 'inferred', title: 'Disclosure is present but too vague to satisfy Art. 12(1)' },
  'art28/missing-clause': { severity: 'blocker', source: 'inferred', title: 'The DPA is missing an Art. 28(3) clause' },
  'eprivacy/missing-disclosure': { severity: 'warn', source: 'inferred', title: 'Cookie policy does not explain something the ePrivacy rules require' },
  'contradiction/page-vs-registry': { severity: 'blocker', source: 'inferred', title: 'The prose contradicts the configured data' },
  'contradiction/page-vs-page': { severity: 'warn', source: 'inferred', title: 'Two legal pages contradict each other' },
  'language/register': { severity: 'warn', source: 'inferred', title: 'Translation does not use the official terminology of its language' },
  'clarity/plain-language': { severity: 'info', source: 'inferred', title: 'Passage is harder to follow than Art. 12(1) expects' },
} as const satisfies Record<string, { severity: Severity; source: FindingSource; title: string; fix?: string }>

export type FindingCode = keyof typeof FINDING_CODES

export const INFERRED_CODES = Object.entries(FINDING_CODES)
  .filter(([, def]) => def.source === 'inferred')
  .map(([code]) => code)

export function isFindingCode(code: string): code is FindingCode {
  return Object.prototype.hasOwnProperty.call(FINDING_CODES, code)
}

/** Stable id: the code plus a hash of whatever makes this occurrence unique. */
export function findingId(code: string, subject: unknown[]): string {
  return `${code}#${shortHash(subject.map((s) => (s === undefined ? null : s)))}`
}

export type FindingInput = {
  code: FindingCode
  subject: unknown[]
  detail: string
  page?: PageRef
  field?: string
  quote?: string
  evidence?: string[]
  title?: string
  fix?: string
  severity?: Severity
  needsInput?: string[]
}

export function makeFinding(input: FindingInput): Finding {
  const def = FINDING_CODES[input.code] as { severity: Severity; source: FindingSource; title: string; fix?: string }
  return {
    id: findingId(input.code, input.subject),
    code: input.code,
    severity: input.severity ?? def.severity,
    source: def.source,
    title: input.title ?? def.title,
    detail: input.detail,
    ...(input.page ? { page: input.page } : {}),
    ...(input.field ? { field: input.field } : {}),
    ...(input.quote ? { quote: input.quote } : {}),
    evidence: input.evidence ?? [],
    ...(input.fix ?? def.fix ? { fix: input.fix ?? def.fix } : {}),
    ...(input.needsInput ? { needsInput: input.needsInput } : {}),
    status: 'open',
  }
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { blocker: 0, warn: 0, info: 0 }
  for (const finding of findings) {
    if (finding.status === 'accepted') continue
    counts[finding.severity] += 1
  }
  return counts
}

const ORDER: Record<Severity, number> = { blocker: 0, warn: 1, info: 2 }

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.code.localeCompare(b.code) || a.id.localeCompare(b.id))
}
