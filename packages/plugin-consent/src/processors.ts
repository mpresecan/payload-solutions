/**
 * Reading the processor register: the recipients you disclose under GDPR Art. 13(1)(e), the
 * transfers under Art. 13(1)(f), and the sub-processor list your customers rely on under Art. 28(2).
 *
 * Processors are deliberately not part of `ConsentConfig`: they are not a consent decision and
 * every visitor would download them for nothing. They have their own endpoint and helpers.
 */
import type { Payload, PayloadRequest, TypedLocale, Where } from 'payload'

import type { AnyDoc, ProcessorRole, ResolvedConsentPluginOptions, TransferMechanism } from './types.js'

export type ProcessorEntry = {
  id: string
  name: string
  legalName?: string
  role: ProcessorRole
  purpose: string
  dataCategories: string[]
  country: string
  transfer: { mechanism: TransferMechanism; fallback?: TransferMechanism; notes?: string }
  privacyUrl?: string
  dpaUrl?: string
  subprocessorsUrl?: string
  subprocessor: boolean
  showInPrivacyPolicy: boolean
  verified: boolean
  status: 'active' | 'removed'
  addedAt?: string
  removedAt?: string
}

export type ProcessorListOptions = {
  locale?: string
  /** Include rows whose status is `removed`. Off by default; the change log turns it on. */
  includeRemoved?: boolean
  /** Only rows published as sub-processors. */
  subprocessorsOnly?: boolean
  req?: PayloadRequest
}

const str = (v: unknown): string | undefined => (v === null || v === undefined || v === '' ? undefined : String(v))

function toEntry(d: AnyDoc): ProcessorEntry {
  const transfer = (d.transfer ?? {}) as Record<string, unknown>
  return {
    id: String(d.id),
    name: String(d.name),
    legalName: str(d.legalName),
    role: String(d.role ?? 'processor') as ProcessorRole,
    purpose: String(d.purpose ?? ''),
    dataCategories: Array.isArray(d.dataCategories) ? (d.dataCategories as string[]).map(String) : [],
    country: String(d.country ?? ''),
    transfer: {
      mechanism: String(transfer.mechanism ?? 'none') as TransferMechanism,
      fallback: str(transfer.fallback) as TransferMechanism | undefined,
      notes: str(transfer.notes),
    },
    privacyUrl: str(d.privacyUrl),
    dpaUrl: str(d.dpaUrl),
    subprocessorsUrl: str(d.subprocessorsUrl),
    subprocessor: d.subprocessor !== false,
    showInPrivacyPolicy: d.showInPrivacyPolicy !== false,
    verified: Boolean(d.verified),
    status: d.status === 'removed' ? 'removed' : 'active',
    addedAt: str(d.addedAt),
    removedAt: str(d.removedAt),
  }
}

/** The register, sorted by name. Returns an empty list when the register is disabled. */
export async function getProcessors(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  input: ProcessorListOptions = {},
): Promise<ProcessorEntry[]> {
  if (!options.processors) return []
  const where: Where[] = []
  if (!input.includeRemoved) where.push({ status: { equals: 'active' } })
  if (input.subprocessorsOnly) where.push({ subprocessor: { equals: true } })
  const result = (await payload.find({
    collection: options.slugs.processors,
    ...(where.length ? { where: { and: where } } : {}),
    sort: 'name',
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req: input.req,
    ...(input.locale ? { locale: input.locale as unknown as TypedLocale } : {}),
  })) as unknown as { docs: AnyDoc[] }
  return result.docs.map(toEntry)
}

export type ProcessorChange = { name: string; change: 'added' | 'removed'; date: string }

export type SubprocessorList = {
  version: string
  changedAt?: string
  noticeDays: number
  noticeEmail?: string
  subscribeUrl?: string
  processors: ProcessorEntry[]
  /** Additions and removals, newest first. */
  changes: ProcessorChange[]
}

/** Everything the public sub-processor page and the `/subprocessors` endpoint need. */
export async function getSubprocessors(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  input: ProcessorListOptions = {},
): Promise<SubprocessorList> {
  const settings = (await payload.findGlobal({
    slug: options.slugs.settings,
    depth: 0,
    overrideAccess: true,
    req: input.req,
  })) as AnyDoc
  const meta = (settings.processors ?? {}) as Record<string, unknown>
  const all = await getProcessors(payload, options, { ...input, includeRemoved: true, subprocessorsOnly: true })

  const changes: ProcessorChange[] = all
    .flatMap<ProcessorChange>((p) => {
      if (p.status === 'removed' && p.removedAt) return [{ name: p.name, change: 'removed', date: p.removedAt }]
      if (p.addedAt) return [{ name: p.name, change: 'added', date: p.addedAt }]
      return []
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    version: String(meta.subprocessorsVersion ?? ''),
    changedAt: str(meta.changedAt),
    noticeDays: Number(meta.noticeDays ?? 30) || 30,
    noticeEmail: str(meta.noticeEmail),
    subscribeUrl: str(meta.subscribeUrl),
    processors: all.filter((p) => p.status === 'active'),
    changes,
  }
}
