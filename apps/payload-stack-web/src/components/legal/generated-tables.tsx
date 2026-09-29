import { PROCESSORS, consentConfig } from '@/lib/consent'
import { Table } from './legal-page'

const STORAGE_LABEL = {
  cookie: 'cookie',
  localStorage: 'local storage',
  sessionStorage: 'session storage',
  indexedDB: 'IndexedDB',
} as const

/**
 * The cookie table, one section per category, generated from the trackers the banner runs on —
 * the equivalent of plugin-consent's `cookieTable` block.
 */
export function CookieTable() {
  return (
    <>
      {consentConfig.categories.map((category) => {
        const trackers = consentConfig.trackers.filter((t) => t.categoryKey === category.key)
        return (
          <section key={category.key}>
            <h3>{category.label}</h3>
            <p>{category.description}</p>
            {trackers.length === 0 ? (
              <p>No cookies or scripts are currently declared in this category.</p>
            ) : (
              <Table
                head={['Service', 'Provider', 'Purpose', 'Cookies / storage']}
                rows={trackers.map((t) => [
                  t.name,
                  t.vendorPrivacyUrl ? (
                    <>
                      {t.vendor} (
                      <a href={t.vendorPrivacyUrl} rel="noopener noreferrer" target="_blank">
                        Privacy policy
                      </a>
                      )
                    </>
                  ) : (
                    t.vendor
                  ),
                  t.purpose,
                  <ul key="cookies" className="legal-cookies">
                    {t.cookies?.map((c) => (
                      <li key={c.name}>
                        <code>{c.name}</code> · {STORAGE_LABEL[c.storage]} · {c.durationText}
                        {c.description ? ` — ${c.description}` : null}
                      </li>
                    ))}
                  </ul>,
                ])}
              />
            )}
          </section>
        )
      })}
    </>
  )
}

/** Recipients of personal data — plugin-consent's `processorTable` block in `recipients` mode. */
export function RecipientsTable() {
  return (
    <Table
      head={['Provider', 'Role', 'Purpose', 'Data', 'Location']}
      rows={PROCESSORS.map((p) => [
        <a key="name" href={p.privacyUrl} rel="noopener noreferrer" target="_blank">
          {p.name}
        </a>,
        p.role,
        p.purpose,
        p.data,
        p.country,
      ])}
    />
  )
}

/** International transfers — plugin-consent's `processorTable` block in `transfers` mode. */
export function TransfersTable() {
  return (
    <Table
      head={['Provider', 'Location', 'Transfer basis']}
      rows={PROCESSORS.map((p) => [p.name, p.country, p.transferBasis])}
    />
  )
}
