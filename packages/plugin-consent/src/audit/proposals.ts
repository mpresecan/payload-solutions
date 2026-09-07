import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload, PayloadRequest, TypedLocale } from 'payload'

import { checklistFor } from './checklists.js'
import { invalidTokens, legalContentToMarkdown, markdownToLegalContent } from './markdown.js'
import { profileQuestion, readProfileState } from './profile.js'
import type { AnyDoc, ResolvedConsentPluginOptions } from '../types.js'
import type { ProfileQuestion } from './types.js'

export const PROPOSALS_DIR = path.join('.consent', 'proposals')

export type Proposal = {
  version: 1
  createdAt: string
  generatedBy?: { agent?: string; model?: string }
  page: { slug: string; locale?: string; kind?: string }
  /** Create the page when it does not exist. Requires `kind` and a title. */
  create?: boolean
  title?: string
  effectiveDate?: string
  markdown: string
  /** Why this change is being made — shown in the diff and stored on the draft. */
  rationale: string
  /** Finding ids this proposal addresses. */
  addresses?: string[]
}

export type ProposalValidation = {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** Questions a human must answer before this proposal can be applied. */
  needsInput: ProfileQuestion[]
  diff?: string
}

const PLACEHOLDER_GUARD: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[[A-Z][A-Z _]{2,}\]/, label: 'a bracketed placeholder' },
  { pattern: /\bTODO\b/i, label: 'a TODO' },
  { pattern: /\byour[ _-]?(company|business|organisation|organization)\b/i, label: '"your company"' },
  { pattern: /\bexample\.(com|org|test)\b/i, label: 'an example.com address' },
  { pattern: /\bLorem ipsum\b/i, label: 'lorem ipsum' },
  { pattern: /\b(TBD|TBC|XXXX?)\b/, label: 'a TBD marker' },
]

export function proposalsDir(root: string): string {
  return path.join(root, PROPOSALS_DIR)
}

export function writeProposal(root: string, proposal: Proposal): string {
  const dir = proposalsDir(root)
  mkdirSync(dir, { recursive: true })
  const name = `${proposal.page.slug}${proposal.page.locale ? `.${proposal.page.locale}` : ''}.json`
  const file = path.join(dir, name)
  writeFileSync(file, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8')
  return file
}

export function readProposals(root: string, only?: string): Proposal[] {
  const dir = proposalsDir(root)
  let entries: string[] = []
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const files = only ? entries.filter((f) => f === path.basename(only)) : entries
  return files.map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Proposal)
}

/** Minimal line diff, enough to show a reviewer what changed before anything is written. */
export function diffLines(before: string, after: string): string {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`)
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push(`- ${a[i++]}`)
    } else {
      out.push(`+ ${b[j++]}`)
    }
  }
  while (i < n) out.push(`- ${a[i++]}`)
  while (j < m) out.push(`+ ${b[j++]}`)
  // Trim long runs of unchanged context so the diff stays readable.
  const trimmed: string[] = []
  let run = 0
  for (const line of out) {
    if (line.startsWith('  ')) {
      run++
      if (run > 3) continue
    } else {
      if (run > 3) trimmed.push(`  … ${run - 3} unchanged lines`)
      run = 0
    }
    trimmed.push(line)
  }
  if (run > 3) trimmed.push(`  … ${run - 3} unchanged lines`)
  return trimmed.join('\n')
}

async function findPage(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  page: Proposal['page'],
  req?: PayloadRequest,
): Promise<AnyDoc | null> {
  const res = (await payload.find({
    collection: options.slugs.legalPages,
    where: { slug: { equals: page.slug } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    ...(page.locale ? { locale: page.locale as unknown as TypedLocale, fallbackLocale: false as unknown as TypedLocale } : {}),
  })) as unknown as { docs: AnyDoc[] }
  return res.docs[0] ?? null
}

/**
 * The gate that makes "never invent legal facts" enforceable.
 *
 * The skill tells the agent to ask rather than guess, but a skill is a request. This is the
 * refusal: a proposal for a document whose checklist depends on an unanswered question is
 * rejected, and the questions come back so the agent can put them to a human in the terminal.
 */
export async function validateProposal(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  proposal: Proposal,
  req?: PayloadRequest,
): Promise<ProposalValidation> {
  const errors: string[] = []
  const warnings: string[] = []

  if (!options.legalPages) errors.push('legal pages are disabled in this project')
  if (proposal.version !== 1) errors.push(`unsupported proposal version ${String(proposal.version)}`)
  if (!proposal.markdown?.trim()) errors.push('the proposal has no markdown')
  if (!proposal.rationale?.trim()) errors.push('every proposal needs a rationale a reviewer can read')

  const bad = invalidTokens(proposal.markdown ?? '')
  if (bad.length) errors.push(`unknown tokens: ${bad.join(', ')} — the converter would print these literally`)

  for (const { pattern, label } of PLACEHOLDER_GUARD) {
    if (pattern.test(proposal.markdown ?? '')) errors.push(`the draft contains ${label}; fill it in or ask for the missing fact`)
  }

  const existing = options.legalPages ? await findPage(payload, options, proposal.page, req) : null
  if (!existing && !proposal.create) {
    errors.push(`no legal page with slug "${proposal.page.slug}"${proposal.page.locale ? ` in ${proposal.page.locale}` : ''}; set "create": true to add one`)
  }
  if (!existing && proposal.create && (!proposal.page.kind || !proposal.title)) {
    errors.push('creating a page needs both "kind" and "title"')
  }

  const kind = String(proposal.page.kind ?? existing?.kind ?? '')
  const checklist = checklistFor(kind)
  const state = await readProfileState(payload, options, req)
  const missingKeys = new Set(state.missing.map((q) => q.key))
  const needed = new Set<string>()
  for (const requirement of checklist?.requirements ?? []) {
    for (const key of requirement.needsInput ?? []) {
      if (missingKeys.has(key)) needed.add(key)
    }
  }
  const needsInput = [...needed].map((key) => profileQuestion(key)).filter((q): q is ProfileQuestion => Boolean(q))
  if (needsInput.length) {
    errors.push(
      `${needsInput.length} legal fact(s) this document depends on have not been answered by a human: ${[...needed].join(', ')}`,
    )
  }

  let diff: string | undefined
  if (existing) {
    const before = await legalContentToMarkdown(payload, existing.content)
    diff = diffLines(before, proposal.markdown ?? '')
    if (before.trim() === (proposal.markdown ?? '').trim()) warnings.push('the proposal is identical to the current page')
  }

  return { ok: errors.length === 0, errors, warnings, needsInput, ...(diff ? { diff } : {}) }
}

export type ApplyOptions = {
  /** Writing is off unless the operator turned it on. */
  allowDrafts?: boolean
  dryRun?: boolean
  agent?: string
  model?: string
}

export type ApplyResult = {
  slug: string
  locale?: string
  applied: boolean
  created?: boolean
  reason?: string
  errors?: string[]
  diff?: string
  id?: string | number
}

/**
 * Applies a proposal as a **draft version**. Never publishes: a person reads the draft in the
 * admin, compares it with what is live, and decides. An agent that could publish would be one
 * bad inference away from putting an invented retention period in front of customers.
 */
export async function applyProposal(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  proposal: Proposal,
  apply: ApplyOptions = {},
  req?: PayloadRequest,
): Promise<ApplyResult> {
  const base = { slug: proposal.page.slug, ...(proposal.page.locale ? { locale: proposal.page.locale } : {}) }
  const validation = await validateProposal(payload, options, proposal, req)
  if (!validation.ok) {
    return { ...base, applied: false, reason: 'validation failed', errors: validation.errors, diff: validation.diff }
  }
  if (apply.dryRun) return { ...base, applied: false, reason: 'dry run', diff: validation.diff }
  if (!apply.allowDrafts) {
    return {
      ...base,
      applied: false,
      reason: 'writing is disabled; re-run with --allow-drafts to save this as a draft version',
      diff: validation.diff,
    }
  }

  const content = await markdownToLegalContent(payload, proposal.markdown)
  const locale = proposal.page.locale ? ({ locale: proposal.page.locale as unknown as TypedLocale } as const) : ({} as const)
  const generatedBy = [proposal.generatedBy?.agent ?? apply.agent, proposal.generatedBy?.model ?? apply.model]
    .filter(Boolean)
    .join(' / ')
  const existing = await findPage(payload, options, proposal.page, req)

  if (!existing) {
    const created = await payload.create({
      collection: options.slugs.legalPages,
      draft: true,
      data: {
        title: proposal.title,
        slug: proposal.page.slug,
        kind: proposal.page.kind,
        effectiveDate: proposal.effectiveDate ?? new Date().toISOString(),
        content,
        _status: 'draft',
      } as never,
      overrideAccess: true,
      req,
      ...locale,
    })
    return { ...base, applied: true, created: true, id: created.id, diff: validation.diff }
  }

  const updated = await payload.update({
    collection: options.slugs.legalPages,
    id: existing.id as string,
    draft: true,
    data: {
      content,
      ...(proposal.title ? { title: proposal.title } : {}),
      ...(proposal.effectiveDate ? { effectiveDate: proposal.effectiveDate } : {}),
      _status: 'draft',
    } as never,
    overrideAccess: true,
    req,
    ...locale,
  })
  return {
    ...base,
    applied: true,
    id: updated.id,
    diff: validation.diff,
    reason: generatedBy ? `saved as a draft version, generated by ${generatedBy}` : 'saved as a draft version',
  }
}
