/**
 * Types for the legal audit: the deterministic scan, the project data map and the
 * compliance profile the agent interviews the operator for.
 *
 * The whole feature rests on one distinction. A finding is `deterministic` when code
 * proved it (a token that never resolved, a processor row nobody verified, a locale with
 * no translation) or `inferred` when a model read prose and formed a judgement. Inferred
 * findings must quote the text they are about, so a human can check the model's homework.
 */

export type Severity = 'blocker' | 'warn' | 'info'

export const SEVERITIES: Severity[] = ['blocker', 'warn', 'info']

/** Who established the finding. Never let a model claim `deterministic`. */
export type FindingSource = 'deterministic' | 'inferred'

export type FindingStatus = 'open' | 'accepted' | 'fixed'

export type PageRef = {
  id?: string | number
  slug: string
  kind: string
  locale?: string
  title?: string
}

export type Finding = {
  /** Stable across runs: `code#hash(subject)`. Acceptances are carried forward by this id. */
  id: string
  code: string
  severity: Severity
  source: FindingSource
  title: string
  detail: string
  page?: PageRef
  /** Field path inside the document, e.g. `content` or `effectiveDate`. */
  field?: string
  /** The text the finding is about. Required for `inferred` findings. */
  quote?: string
  evidence: string[]
  /** What a human (or the agent) should do about it. */
  fix?: string
  /** Profile keys that must be answered before this can be drafted. */
  needsInput?: string[]
  /** Model self-assessment, 0–1. Only meaningful for `inferred`. */
  confidence?: number
  status?: FindingStatus
  /** Why an accepted finding was accepted. Carried forward from the stored audit. */
  reason?: string
}

export type ProfileAnswer = {
  key: string
  question?: string
  answer: string
  answeredBy?: string
  answeredAt?: string
}

export type ComplianceProfile = {
  legalName?: string
  tradingName?: string
  address?: string
  contactEmail?: string
  websiteUrl?: string
  establishmentCountry?: string
  dpo?: { required?: 'yes' | 'no' | 'unknown'; name?: string; email?: string }
  audience?: 'b2b' | 'b2c' | 'both'
  role?: 'controller' | 'processor' | 'both'
  offersToEEA?: boolean
  offersToUK?: boolean
  usStates?: string
  governingLaw?: string
  supervisoryAuthority?: string
  dsrEmail?: string
  automatedDecisions?: 'none' | 'profiling' | 'adm'
  retention?: Array<{ purpose?: string; period?: string }>
  legalBases?: Array<{ purpose?: string; basis?: string; notes?: string }>
  answers?: ProfileAnswer[]
  confirmedAt?: string
}

/** One question the agent must put to a human rather than answer itself. */
export type ProfileQuestion = {
  key: string
  question: string
  /** Why the law needs it — the agent repeats this so the person can answer meaningfully. */
  why: string
  cite?: string
  severity: Severity
  /** Answer shape hint: free text, a yes/no, or a list of `purpose: period` pairs. */
  shape: 'text' | 'boolean' | 'pairs' | 'choice'
  choices?: string[]
}

export type ProfileState = {
  profile: ComplianceProfile
  /** Unanswered questions, in the order the agent should ask them. */
  missing: ProfileQuestion[]
  complete: boolean
}

/** A recipient of personal data inferred from the project rather than declared by a human. */
export type DetectedVendor = {
  /** Processor preset key when the vendor maps to one. */
  preset?: string
  name: string
  /**
   * How it was detected. Environment detections are recorded as the vendor, never as the
   * variable name — an infrastructure inventory has no business in a customer's database.
   */
  via: 'dependency' | 'environment' | 'payload-plugin'
  detail: string
}

export type PersonalDataField = {
  path: string
  category: string
  reason: string
}

export type CollectionDataMap = {
  slug: string
  auth: boolean
  upload: boolean
  /** Excluded from disclosure prompts (the plugin's own consent records, for example). */
  excluded?: string
  fields: PersonalDataField[]
  categories: string[]
}

export type ProjectFacts = {
  root: string
  packageName?: string
  vendors: DetectedVendor[]
  collections: CollectionDataMap[]
  /** Union of categories across collections. */
  categories: string[]
  locales: string[]
  defaultLocale?: string
}

export type ScanCounts = Record<Severity, number>

export type ScanResult = {
  scannedAt: string
  toolVersion: string
  project: ProjectFacts
  profile: ProfileState
  counts: ScanCounts
  findings: Finding[]
}
