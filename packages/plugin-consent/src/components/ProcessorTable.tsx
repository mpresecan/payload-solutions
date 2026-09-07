import type { ReactNode } from 'react'

import type { ProcessorEntry, SubprocessorList } from '../processors.js'
import type { ProcessorRole, TransferMechanism } from '../types.js'

export type ProcessorTableMode = 'recipients' | 'transfers' | 'subprocessors' | 'annex' | 'changes'

export type ProcessorTableLabels = {
  provider: string
  entity: string
  role: string
  purpose: string
  data: string
  location: string
  mechanism: string
  safeguards: string
  dpa: string
  privacyPolicy: string
  since: string
  change: string
  date: string
  none: string
}

export const DEFAULT_PROCESSOR_TABLE_LABELS: ProcessorTableLabels = {
  provider: 'Provider',
  entity: 'Legal entity',
  role: 'Role',
  purpose: 'Purpose',
  data: 'Data',
  location: 'Location',
  mechanism: 'Transfer basis',
  safeguards: 'Safeguards',
  dpa: 'DPA',
  privacyPolicy: 'Privacy policy',
  since: 'Since',
  change: 'Change',
  date: 'Date',
  none: 'No providers are currently listed.',
}

const ROLE_LABELS: Record<ProcessorRole, string> = {
  processor: 'Processor',
  'sub-processor': 'Sub-processor',
  'independent-controller': 'Independent controller',
  'joint-controller': 'Joint controller',
}

const MECHANISM_LABELS: Record<TransferMechanism, string> = {
  none: 'No transfer',
  adequacy: 'Adequacy decision',
  dpf: 'EU–US Data Privacy Framework',
  scc: 'Standard Contractual Clauses',
  bcr: 'Binding Corporate Rules',
  derogation: 'Art. 49 derogation',
}

const DATA_LABELS: Record<string, string> = {
  account: 'account',
  contact: 'contact',
  billing: 'billing',
  content: 'content',
  usage: 'usage',
  technical: 'technical',
  support: 'support',
  marketing: 'marketing',
  special: 'special category',
}

const day = (value?: string): string => (value ? value.slice(0, 10) : '—')

export type ProcessorTableProps = {
  processors: ProcessorEntry[]
  mode?: ProcessorTableMode
  showRole?: boolean
  /** Only needed for `mode="changes"`. */
  changes?: SubprocessorList['changes']
  labels?: Partial<ProcessorTableLabels>
  className?: string
}

/** Pure presentational table. No colours or spacing of its own — style `[data-consent-processors]`. */
export function ProcessorTable({ processors, mode = 'recipients', showRole = true, changes, labels: overrides, className }: ProcessorTableProps) {
  const l = { ...DEFAULT_PROCESSOR_TABLE_LABELS, ...overrides }
  const rows = mode === 'subprocessors' || mode === 'annex' ? processors.filter((p) => p.subprocessor) : processors.filter((p) => p.showInPrivacyPolicy)

  if (mode === 'changes') {
    const entries = changes ?? []
    return (
      <div className={className} data-consent-processors="changes">
        {entries.length === 0 ? (
          <p>No changes have been announced.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{l.date}</th>
                <th scope="col">{l.provider}</th>
                <th scope="col">{l.change}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((c) => (
                <tr key={`${c.name}:${c.date}:${c.change}`}>
                  <td>{day(c.date)}</td>
                  <td>{c.name}</td>
                  <td>{c.change === 'added' ? 'Added' : 'Removed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={className} data-consent-processors={mode}>
        <p>{l.none}</p>
      </div>
    )
  }

  const name = (p: ProcessorEntry): ReactNode =>
    p.privacyUrl ? (
      <a href={p.privacyUrl} rel="noopener noreferrer" target="_blank">
        {p.name}
      </a>
    ) : (
      p.name
    )

  const columns: Array<{ key: string; head: string; cell: (p: ProcessorEntry) => ReactNode }> = [
    { key: 'provider', head: l.provider, cell: name },
  ]
  if (mode === 'annex') columns.push({ key: 'entity', head: l.entity, cell: (p) => p.legalName ?? p.name })
  if (showRole && mode !== 'transfers') columns.push({ key: 'role', head: l.role, cell: (p) => ROLE_LABELS[p.role] })
  if (mode !== 'transfers') columns.push({ key: 'purpose', head: l.purpose, cell: (p) => p.purpose })
  if (mode === 'annex' || mode === 'recipients')
    columns.push({
      key: 'data',
      head: l.data,
      cell: (p) => (p.dataCategories.length ? p.dataCategories.map((c) => DATA_LABELS[c] ?? c).join(', ') : '—'),
    })
  columns.push({ key: 'location', head: l.location, cell: (p) => p.country || '—' })
  if (mode === 'transfers') {
    columns.push({ key: 'mechanism', head: l.mechanism, cell: (p) => MECHANISM_LABELS[p.transfer.mechanism] })
    columns.push({
      key: 'safeguards',
      head: l.safeguards,
      cell: (p) =>
        [p.transfer.notes, p.transfer.fallback ? `Fallback: ${MECHANISM_LABELS[p.transfer.fallback]}` : null].filter(Boolean).join(' · ') || '—',
    })
  }
  if (mode === 'subprocessors') {
    columns.push({ key: 'since', head: l.since, cell: (p) => day(p.addedAt) })
    columns.push({
      key: 'dpa',
      head: l.dpa,
      cell: (p) =>
        p.dpaUrl ? (
          <a href={p.dpaUrl} rel="noopener noreferrer" target="_blank">
            {l.dpa}
          </a>
        ) : (
          '—'
        ),
    })
  }

  return (
    <div className={className} data-consent-processors={mode}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              {columns.map((c) => (
                <td key={c.key}>{c.cell(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
