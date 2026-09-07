import type { Payload, PayloadRequest } from 'payload'

import type { AnyDoc, ResolvedConsentPluginOptions } from '../types.js'
import type { ComplianceProfile, ProfileAnswer, ProfileQuestion, ProfileState } from './types.js'

/**
 * The facts a model must never invent.
 *
 * Every question here decides something a regulator would read literally: who the controller
 * is, on what basis you process, how long you keep things. A plausible-sounding guess is worse
 * than a blank, because a blank gets noticed. So the agent asks in the terminal, the answer is
 * stored with provenance, and `validateProposal` refuses to draft anything that depends on an
 * answer nobody gave.
 */
export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    key: 'legalName',
    question: 'What is the full legal name of the entity that decides how personal data is used?',
    why: 'Every privacy policy must name the controller. A trading name is not enough — this is the entity a data subject would write to, or sue.',
    cite: 'GDPR Art. 13(1)(a)',
    severity: 'blocker',
    shape: 'text',
  },
  {
    key: 'address',
    question: 'What is that entity’s registered postal address?',
    why: 'The controller’s identity and contact details must be given, and an email address alone has repeatedly been held insufficient.',
    cite: 'GDPR Art. 13(1)(a)',
    severity: 'blocker',
    shape: 'text',
  },
  {
    key: 'contactEmail',
    question: 'Which email address should privacy enquiries go to?',
    why: 'Data subjects need a working route to the controller; this address is published in the policy.',
    cite: 'GDPR Art. 13(1)(a)',
    severity: 'blocker',
    shape: 'text',
  },
  {
    key: 'establishmentCountry',
    question: 'In which country is the entity established? (ISO code, e.g. PL, HR, IE)',
    why: 'It decides your lead supervisory authority, the governing law of the documents, and whether the EEA rules apply directly.',
    cite: 'GDPR Art. 56',
    severity: 'blocker',
    shape: 'text',
  },
  {
    key: 'dpo',
    question: 'Have you appointed a Data Protection Officer? If so, give the name and email; if not, answer "no".',
    why: 'If a DPO exists, their contact details are a mandatory disclosure. Saying nothing is not the same as saying there is none.',
    cite: 'GDPR Art. 13(1)(b), Art. 37',
    severity: 'blocker',
    shape: 'text',
  },
  {
    key: 'audience',
    question: 'Do you sell to businesses, to consumers, or both?',
    why: 'It decides whether a DPA and sub-processor notice obligations apply to you, and how the terms are written.',
    severity: 'warn',
    shape: 'choice',
    choices: ['b2b', 'b2c', 'both'],
  },
  {
    key: 'role',
    question: 'For your customers’ data, are you the controller, a processor, or both?',
    why: 'A processor owes Art. 28 duties and needs a DPA; a controller owes Art. 13 disclosures. Getting this backwards produces a document that describes someone else’s business.',
    cite: 'GDPR Art. 4(7), 4(8)',
    severity: 'blocker',
    shape: 'choice',
    choices: ['controller', 'processor', 'both'],
  },
  {
    key: 'legalBases',
    question: 'For each purpose you process personal data (accounts, billing, support, marketing, analytics), what is the legal basis?',
    why: 'A legal basis per purpose is mandatory, and where you rely on legitimate interests you must also state what that interest is.',
    cite: 'GDPR Art. 13(1)(c), 13(1)(d)',
    severity: 'blocker',
    shape: 'pairs',
  },
  {
    key: 'retention',
    question: 'How long do you keep each kind of data, or what criteria decide it?',
    why: 'A retention period or the criteria used to determine it is mandatory. "As long as necessary" on its own does not satisfy it.',
    cite: 'GDPR Art. 13(2)(a)',
    severity: 'blocker',
    shape: 'pairs',
  },
  {
    key: 'dsrEmail',
    question: 'Where should access, deletion and objection requests be sent?',
    why: 'The rights are only real if the policy says how to use them.',
    cite: 'GDPR Art. 13(2)(b), Art. 12(2)',
    severity: 'warn',
    shape: 'text',
  },
  {
    key: 'supervisoryAuthority',
    question: 'Which supervisory authority would a complaint go to?',
    why: 'The right to lodge a complaint must be stated, and naming the authority is what makes it usable.',
    cite: 'GDPR Art. 13(2)(d)',
    severity: 'warn',
    shape: 'text',
  },
  {
    key: 'automatedDecisions',
    question: 'Do you make automated decisions with legal or similarly significant effects, or profile people? (none / profiling / adm)',
    why: 'If you do, you must say so and explain the logic and consequences. If you do not, the policy should not imply that you might.',
    cite: 'GDPR Art. 13(2)(f), Art. 22',
    severity: 'warn',
    shape: 'choice',
    choices: ['none', 'profiling', 'adm'],
  },
  {
    key: 'governingLaw',
    question: 'Which law governs your terms of service?',
    why: 'The terms need a governing law and forum; leaving it blank makes the whole clause unusable.',
    severity: 'warn',
    shape: 'text',
  },
]

const QUESTION_BY_KEY = new Map(PROFILE_QUESTIONS.map((q) => [q.key, q]))

export function profileQuestion(key: string): ProfileQuestion | undefined {
  return QUESTION_BY_KEY.get(key)
}

function filled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((entry) => entry && Object.values(entry as object).some((v) => typeof v === 'string' && v.trim()))
  if (typeof value === 'object') return Object.values(value as object).some(filled)
  return true
}

/** Answers recorded through `consent_profile` satisfy a question just as a typed field does. */
function answered(profile: ComplianceProfile, key: string): boolean {
  if (filled((profile as Record<string, unknown>)[key])) return true
  return (profile.answers ?? []).some((a) => a.key === key && a.answer?.trim())
}

export function evaluateProfile(profile: ComplianceProfile): ProfileState {
  const missing = PROFILE_QUESTIONS.filter((question) => {
    if (question.key === 'governingLaw' && profile.audience === 'b2c') return !answered(profile, question.key)
    return !answered(profile, question.key)
  })
  return { profile, missing, complete: missing.length === 0 }
}

export async function readProfile(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  req?: PayloadRequest,
): Promise<ComplianceProfile> {
  const settings = (await payload.findGlobal({ slug: options.slugs.settings, depth: 0, overrideAccess: true, req })) as AnyDoc
  const compliance = (settings.compliance ?? {}) as ComplianceProfile
  return compliance
}

export async function readProfileState(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  req?: PayloadRequest,
): Promise<ProfileState> {
  return evaluateProfile(await readProfile(payload, options, req))
}

export type RecordAnswersInput = {
  answers: Array<{ key: string; answer: string }>
  answeredBy?: string
}

/**
 * Stores interview answers on the compliance profile. Anything matching a first-class field is
 * written there; everything else lands in `answers` with provenance so the next run does not
 * ask again and a reviewer can see who said it.
 */
export async function recordProfileAnswers(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  input: RecordAnswersInput,
  req?: PayloadRequest,
): Promise<ProfileState> {
  const current = await readProfile(payload, options, req)
  const now = new Date().toISOString()
  const next: Record<string, unknown> = { ...current }
  const answers: ProfileAnswer[] = [...(current.answers ?? [])]

  const simple = new Set([
    'legalName',
    'tradingName',
    'address',
    'contactEmail',
    'websiteUrl',
    'establishmentCountry',
    'governingLaw',
    'supervisoryAuthority',
    'dsrEmail',
    'usStates',
  ])
  const choices: Record<string, string[]> = {
    audience: ['b2b', 'b2c', 'both'],
    role: ['controller', 'processor', 'both'],
    automatedDecisions: ['none', 'profiling', 'adm'],
  }

  for (const { key, answer } of input.answers) {
    const value = answer.trim()
    if (!value) continue
    if (simple.has(key)) {
      next[key] = value
    } else if (choices[key]) {
      next[key] = choices[key].includes(value.toLowerCase()) ? value.toLowerCase() : value
    } else if (key === 'dpo') {
      const none = /^(no|none|not appointed)$/i.test(value)
      const email = /[^\s<]+@[^\s>]+/.exec(value)?.[0]
      next.dpo = none ? { required: 'no' } : { required: 'yes', email, name: email ? value.replace(email, '').replace(/[<>,]/g, '').trim() : value }
    } else if (key === 'retention' || key === 'legalBases') {
      const pairs = value
        .split(/[\n;]+/)
        .map((line) => line.split(/:|—|--/))
        .filter((parts) => parts.length >= 2)
        .map((parts) => ({ purpose: parts[0].trim(), [key === 'retention' ? 'period' : 'basis']: parts.slice(1).join(':').trim() }))
      if (pairs.length) next[key] = pairs
    }
    const existing = answers.findIndex((a) => a.key === key)
    const record: ProfileAnswer = {
      key,
      question: QUESTION_BY_KEY.get(key)?.question,
      answer: value,
      answeredBy: input.answeredBy,
      answeredAt: now,
    }
    if (existing >= 0) answers[existing] = record
    else answers.push(record)
  }

  next.answers = answers
  next.confirmedAt = now
  await payload.updateGlobal({
    slug: options.slugs.settings,
    data: { compliance: next } as never,
    overrideAccess: true,
    req,
  })
  return evaluateProfile(next as ComplianceProfile)
}
