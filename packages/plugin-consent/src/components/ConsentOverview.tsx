import type { Payload } from 'payload'

import { getConsentOverview } from '../server.js'

/** Admin dashboard widget (registered via `admin.components.beforeDashboard`). */
export async function ConsentOverview(props: { payload: Payload }) {
  const overview = await getConsentOverview(props.payload)
  const categories = Object.entries(overview.grantedLast30Days)
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 4, padding: '16px 20px', marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Payload Consent</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--theme-elevation-600)' }}>
        {overview.enabled ? 'Enabled' : 'Disabled'} · policy version <code>{overview.versions.policyVersion ?? '—'}</code>
        {overview.versions.bumpedAt ? ` (changed ${new Date(overview.versions.bumpedAt).toLocaleDateString()})` : ''} · {overview.trackers} trackers,{' '}
        {overview.trackersWithCookies} with declared cookies
        {overview.processors > 0 ? ` · ${overview.processors} processors, ${overview.subprocessors} published as sub-processors` : ''} ·{' '}
        {overview.totalRecords} records total
      </p>
      <p style={{ margin: '0 0 8px' }}>
        Last 30 days: {overview.last30Days} decisions
        {overview.last30Days > 0 && categories.length > 0
          ? ` — ${categories.map(([k, n]) => `${k} ${Math.round((n / overview.last30Days) * 100)}%`).join(', ')}`
          : ''}
      </p>
      {overview.warnings.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--theme-warning-600, #b45309)' }}>
          {overview.warnings.slice(0, 6).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
