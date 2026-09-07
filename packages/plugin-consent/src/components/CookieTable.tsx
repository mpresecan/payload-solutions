import type { ReactNode } from 'react'

import type { ConsentCategory, ConsentTracker } from '@payload-solutions/consent-core'

import { consentTableConverters } from './RichTextTable.js'

export type CookieTableLabels = {
  name: string
  vendor: string
  purpose: string
  cookies: string
  duration: string
  none: string
  privacyPolicy: string
}

export const DEFAULT_COOKIE_TABLE_LABELS: CookieTableLabels = {
  name: 'Service',
  vendor: 'Provider',
  purpose: 'Purpose',
  cookies: 'Cookies / storage',
  duration: 'Duration',
  none: 'No cookies or scripts are currently declared in this category.',
  privacyPolicy: 'Privacy policy',
}

export type CookieTableProps = {
  categories: ConsentCategory[]
  trackers: ConsentTracker[]
  groupBy?: 'category' | 'vendor'
  showDurations?: boolean
  labels?: Partial<CookieTableLabels>
  className?: string
}

/** Pure presentational table: one section per category (or vendor). Style with `className` / global CSS. */
export function CookieTable({ categories, trackers, groupBy = 'category', showDurations = true, labels: labelOverrides, className }: CookieTableProps) {
  const labels = { ...DEFAULT_COOKIE_TABLE_LABELS, ...labelOverrides }
  const groups: Array<{ title: string; description?: string; items: ConsentTracker[] }> =
    groupBy === 'vendor'
      ? [...new Set(trackers.map((t) => t.vendor ?? t.name))].map((vendor) => ({
          title: vendor,
          items: trackers.filter((t) => (t.vendor ?? t.name) === vendor),
        }))
      : categories.map((c) => ({ title: c.label, description: c.description, items: trackers.filter((t) => t.categoryKey === c.key) }))

  return (
    <div className={className} data-consent-cookie-table="">
      {groups.map((group) => (
        <section key={group.title} data-consent-group="">
          <h3>{group.title}</h3>
          {group.description ? <p>{group.description}</p> : null}
          {group.items.length === 0 ? (
            <p>{labels.none}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">{labels.name}</th>
                  <th scope="col">{labels.vendor}</th>
                  <th scope="col">{labels.purpose}</th>
                  <th scope="col">{labels.cookies}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      {t.vendor ?? '—'}
                      {t.vendorPrivacyUrl ? (
                        <>
                          {' '}
                          (<a href={t.vendorPrivacyUrl} rel="noopener noreferrer" target="_blank">{labels.privacyPolicy}</a>)
                        </>
                      ) : null}
                    </td>
                    <td>{t.purpose ?? '—'}</td>
                    <td>
                      {t.cookies && t.cookies.length > 0 ? (
                        <ul>
                          {t.cookies.map((c) => (
                            <li key={`${c.name}:${c.domain ?? ''}`}>
                              <code>{c.name}</code>
                              {c.storage && c.storage !== 'cookie' ? ` (${c.storage})` : ''}
                              {showDurations && c.durationText ? ` · ${c.durationText}` : ''}
                              {c.description ? ` — ${c.description}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  )
}


type ConverterData = {
  categories: ConsentCategory[]
  trackers: ConsentTracker[]
  documentsVersion?: string
  effectiveDate?: string
  labels?: Partial<CookieTableLabels>
}

/**
 * Everything needed to render a legal page: the plugin's blocks plus semantic
 * tables. This is the one to spread in `RichText`:
 *
 *   converters={({ defaultConverters }) => ({ ...defaultConverters, ...legalPageConverters({ categories, trackers }) })}
 */
export function legalPageConverters(data: ConverterData) {
  return { ...consentTableConverters, ...consentBlockConverters(data) }
}

/**
 * Lexical JSX converters for the two blocks only. Prefer `legalPageConverters`
 * unless you already have your own table converter.
 */
export function consentBlockConverters(data: ConverterData) {
  return {
    blocks: {
      cookieTable: ({ node }: { node: { fields: { groupBy?: 'category' | 'vendor'; showDurations?: boolean } } }): ReactNode => (
        <CookieTable categories={data.categories} trackers={data.trackers} groupBy={node.fields.groupBy} showDurations={node.fields.showDurations !== false} labels={data.labels} />
      ),
      policyVersion: ({ node }: { node: { fields: { prefix?: string } } }): ReactNode => (
        <p data-consent-policy-version="">
          {node.fields.prefix ?? 'Version'} {data.documentsVersion ?? '—'}
          {data.effectiveDate ? `, effective ${data.effectiveDate}` : ''}
        </p>
      ),
    },
  }
}

