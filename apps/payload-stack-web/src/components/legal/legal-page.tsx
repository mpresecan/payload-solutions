import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { COMPANY, LEGAL_EFFECTIVE_DATE, consentConfig, formatLegalDate } from '@/lib/consent'

/**
 * Shell for /legal/*: the same article layout as payload.solutions/legal/<slug>, with the body
 * written in JSX rather than rich text because this site has no CMS. The `.legal` styles in
 * globals.css stand in for the prose styles payload.solutions gets from Fumadocs.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <article className="container-content py-16 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm text-fg-muted">Effective {formatLegalDate(LEGAL_EFFECTIVE_DATE)}</p>
            <div className="legal mt-10">{children}</div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}

/** The policy version line, as plugin-consent's `policyVersion` block renders it. */
export function PolicyVersion() {
  return (
    <p className="text-sm text-fg-muted">
      Version {consentConfig.versions.documentsVersion}, effective {formatLegalDate(LEGAL_EFFECTIVE_DATE)}
    </p>
  )
}

export function ContactBlock() {
  return (
    <p>
      <strong>{COMPANY.legalName}</strong>
      <br />
      {COMPANY.address}
      <br />
      Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      <br />
      Website: <a href={COMPANY.url}>{COMPANY.url}</a>
    </p>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="legal-table">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
