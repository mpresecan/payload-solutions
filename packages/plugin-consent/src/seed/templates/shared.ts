import type { CompanyInfo } from '../../types.js'

export const NOT_LEGAL_ADVICE =
  '> **Review before publishing.** This document was generated from a template and your company details. It is not legal advice; have it reviewed for your jurisdiction and business.'

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function jurisdictionsText(company: CompanyInfo): string {
  const list = company.jurisdictions?.length ? company.jurisdictions : ['the European Economic Area', 'the United Kingdom']
  return list.map((j) => ({ EEA: 'the European Economic Area', GB: 'the United Kingdom', UK: 'the United Kingdom', US: 'the United States', CH: 'Switzerland' })[j] ?? j).join(' and ')
}

export function contactBlock(company: CompanyInfo): string {
  const lines = [`**${company.legalName}**`, company.address, `Email: ${company.email}`]
  if (company.url) lines.push(`Website: ${company.url}`)
  if (company.dpo && typeof company.dpo === 'object') {
    lines.push(`Data Protection Officer${company.dpo.name ? ` (${company.dpo.name})` : ''}: ${company.dpo.email}`)
  }
  return lines.join('  \n')
}
