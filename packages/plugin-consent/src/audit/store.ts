import type { Payload, PayloadRequest } from 'payload'

import { countBySeverity, isFindingCode, sortFindings } from './findings.js'
import type { AnyDoc, ResolvedConsentPluginOptions } from '../types.js'
import type { Finding, ScanResult, Severity } from './types.js'

/** Loads the most recent stored audit, so acceptances carry into the next run. */
export async function latestAudit(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  req?: PayloadRequest,
): Promise<{ id: string | number; findings: Finding[] } | null> {
  if (!options.audits) return null
  const res = (await payload.find({
    collection: options.slugs.audits,
    sort: '-runAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })) as unknown as { docs: AnyDoc[] }
  const doc = res.docs[0]
  if (!doc) return null
  return { id: doc.id as string | number, findings: fromStored(doc) }
}

function fromStored(doc: AnyDoc): Finding[] {
  const rows = Array.isArray(doc.findings) ? (doc.findings as AnyDoc[]) : []
  return rows.map((row) => ({
    id: String(row.findingId),
    code: String(row.code),
    severity: String(row.severity) as Severity,
    source: row.source === 'inferred' ? 'inferred' : 'deterministic',
    title: String(row.title ?? ''),
    detail: String(row.detail ?? ''),
    evidence: row.evidence ? String(row.evidence).split('\n').filter(Boolean) : [],
    ...(row.quote ? { quote: String(row.quote) } : {}),
    ...(row.fix ? { fix: String(row.fix) } : {}),
    ...(row.locale ? { page: { slug: '', kind: '', locale: String(row.locale) } } : {}),
    status: (row.status as Finding['status']) ?? 'open',
    ...(row.reason ? { reason: String(row.reason) } : {}),
  }))
}

export type SaveAuditInput = {
  result: ScanResult
  /** Findings the agent added on top of the scan. Each must quote the text it judges. */
  inferred?: Finding[]
  agent?: string
  model?: string
  label?: string
}

/** Rejects an inferred finding that arrives without the evidence that makes it checkable. */
export function validateInferred(findings: Finding[]): string[] {
  const errors: string[] = []
  for (const finding of findings) {
    if (!isFindingCode(finding.code)) {
      errors.push(`unknown finding code "${finding.code}"`)
      continue
    }
    if (finding.source !== 'inferred') {
      errors.push(`"${finding.code}": only the scan may report deterministic findings`)
    }
    if (!finding.quote?.trim() && !finding.evidence?.length) {
      errors.push(`"${finding.code}": a model-judged finding must quote the text it is about`)
    }
    if (!finding.title?.trim() || !finding.detail?.trim()) {
      errors.push(`"${finding.code}": needs a title and a detail`)
    }
  }
  return errors
}

/**
 * Writes the run into the audits collection so the people who fix these things can see them
 * without a terminal. Acceptances from the previous run are already merged into `result` by
 * `carryForward`, and are written back here with their reasons intact.
 */
export async function saveAudit(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  input: SaveAuditInput,
  req?: PayloadRequest,
): Promise<{ id: string | number } | null> {
  if (!options.audits) return null
  const { result } = input
  const findings = sortFindings([...result.findings, ...(input.inferred ?? [])])
  const counts = countBySeverity(findings)
  const accepted = findings.filter((f) => f.status === 'accepted').length

  const doc = await payload.create({
    collection: options.slugs.audits,
    data: {
      label: input.label ?? `scan ${result.scannedAt.slice(0, 10)}`,
      runAt: result.scannedAt,
      agent: input.agent,
      model: input.model,
      toolVersion: result.toolVersion,
      blockers: counts.blocker,
      warnings: counts.warn,
      notices: counts.info,
      accepted,
      findings: findings.map((finding) => ({
        findingId: finding.id,
        code: finding.code,
        severity: finding.severity,
        source: finding.source,
        title: finding.title,
        detail: finding.detail,
        quote: finding.quote,
        evidence: finding.evidence.join('\n'),
        fix: finding.fix,
        locale: finding.page?.locale,
        confidence: finding.confidence,
        ...(options.legalPages && finding.page?.id ? { page: finding.page.id } : {}),
        status: finding.status ?? 'open',
        reason: finding.reason,
      })),
      scope: {
        locales: result.project.locales,
        vendors: result.project.vendors.map((v) => ({ name: v.name, via: v.via })),
        categories: result.project.categories,
        collections: result.project.collections.map((c) => ({ slug: c.slug, categories: c.categories, excluded: c.excluded })),
        profileComplete: result.profile.complete,
        unanswered: result.profile.missing.map((q) => q.key),
      },
    } as never,
    overrideAccess: true,
    req,
  })
  return { id: doc.id }
}
