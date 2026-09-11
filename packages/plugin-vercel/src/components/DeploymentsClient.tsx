'use client'
import type { ClientField, Column } from 'payload'

import { Banner, Button, Collapsible, Drawer, Pill, Popup, PopupList, Table, toast, useModal } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import type { DeploymentRecord, PendingChange, TargetStatus } from '../types.js'
import type { VercelDeployment } from '../vercel/types.js'
import type { DeploymentsViewData } from './DeploymentsView.js'

import { formatDuration } from '../utils/duration.js'
import { ApiError, invalidateStatus, relativeTime, vercelApi } from './api.js'
import { DEPLOY_DRAWER_SLUG, DeployDrawer } from './DeployDrawer.js'
import { causeLabel, present, stateLabel, statePillStyle } from './status.js'
import { useVercelStatus } from './useVercelStatus.js'

const VIEW_DEPLOY_DRAWER = `${DEPLOY_DRAWER_SLUG}-view`
const CHANGES_DRAWER = 'plugin-vercel-changes'
const ROLLBACK_DRAWER = 'plugin-vercel-rollback'

type Props = { initial: DeploymentsViewData }

/** Build the `Column[]` shape Payload's `Table` expects from plain headings and cell renderers. */
function columns<T extends { id: number | string }>(rows: T[], defs: { accessor: string; heading: string; render: (row: T) => React.ReactNode }[]): Column[] {
  return defs.map((def) => ({
    accessor: def.accessor,
    active: true,
    field: { name: def.accessor, type: 'text' } as ClientField,
    Heading: <span>{def.heading}</span>,
    renderedCells: rows.map((row) => <React.Fragment key={`${def.accessor}-${row.id}`}>{def.render(row)}</React.Fragment>),
  }))
}

function userLabel(value: DeploymentRecord['triggeredBy']): string {
  if (!value) {
    return '—'
  }
  if (typeof value === 'object') {
    return value.email ?? value.name ?? `#${value.id}`
  }
  return `#${value}`
}

const noop = () => () => {}

export const DeploymentsClient: React.FC<Props> = ({ initial }) => {
  const { apiRoute, data, now: clock, refresh } = useVercelStatus()
  // The view is server-rendered: relative times and countdowns must hydrate from the server's clock, not
  // the browser's, or the text differs by a second and React throws the tree away.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  const now = hydrated ? clock : new Date(initial.now).getTime()
  const { openModal } = useModal()
  const targets = data?.targets ?? initial.targets
  const permissions = data?.permissions ?? initial.permissions
  const autoDeploy = data ? Boolean(data.autoDeploy) : Boolean(initial.autoDeploy)
  const [pending, setPending] = useState(initial.pending)
  const [history, setHistory] = useState(initial.history)
  const [changesFor, setChangesFor] = useState<DeploymentRecord | null>(null)
  const [rollbackFor, setRollbackFor] = useState<null | { candidates: VercelDeployment[]; loading: boolean; target: TargetStatus }>(null)
  const [busy, setBusy] = useState<null | string>(null)

  const reloadLists = useCallback(async () => {
    const nextPending: Record<string, PendingChange[]> = {}
    const nextHistory: Record<string, DeploymentRecord[]> = {}
    await Promise.all(
      targets.map(async (t) => {
        try {
          const [c, h] = await Promise.all([vercelApi.changes(apiRoute, t.slug, 50), vercelApi.history(apiRoute, t.slug, 20)])
          nextPending[t.slug] = c.changes
          nextHistory[t.slug] = h.deployments
        } catch {
          nextPending[t.slug] = pending[t.slug] ?? []
          nextHistory[t.slug] = history[t.slug] ?? []
        }
      }),
    )
    setPending(nextPending)
    setHistory(nextHistory)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRoute, targets.map((t) => t.slug).join(',')])

  // Re-read the tables whenever the shared status changes (every poll).
  const statusKey = data ? data.now : ''
  useEffect(() => {
    if (statusKey) {
      void reloadLists()
    }
  }, [statusKey, reloadLists])

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, success: string) => {
      setBusy(key)
      try {
        await fn()
        toast.success(success)
        invalidateStatus()
        await refresh({ tick: false })
        await reloadLists()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'The request failed')
      } finally {
        setBusy(null)
      }
    },
    [refresh, reloadLists],
  )

  const openRollback = useCallback(
    async (target: TargetStatus) => {
      setRollbackFor({ candidates: [], loading: true, target })
      openModal(ROLLBACK_DRAWER)
      try {
        const res = await vercelApi.rollbackCandidates(apiRoute, target.slug)
        setRollbackFor({ candidates: res.candidates, loading: false, target })
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load rollback candidates')
        setRollbackFor({ candidates: [], loading: false, target })
      }
    },
    [apiRoute, openModal],
  )

  const stale = useMemo(() => targets.filter((t) => t.configured && t.dueAt && t.lastTickAt && now - new Date(t.lastTickAt).getTime() > 15 * 60_000), [now, targets])

  return (
    <div className="plugin-vercel-view" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--base)' }}>
      <div style={{ alignItems: 'baseline', display: 'flex', flexWrap: 'wrap', gap: 'var(--base)', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Deployments</h1>
        {permissions.deploy && (
          <Button buttonStyle="primary" onClick={() => openModal(VIEW_DEPLOY_DRAWER)} size="medium">
            Deploy
          </Button>
        )}
      </div>

      {stale.length > 0 && (
        <Banner type="error">
          {stale.map((t) => t.label).join(', ')}: changes are waiting but no runner has ticked in 15 minutes. Keep an admin tab open, run the <code>vercel:tick</code> job, or call{' '}
          <code>POST {apiRoute}/vercel/tick</code> from a cron.
        </Banner>
      )}

      {targets.map((t) => {
        const p = present(t, now, autoDeploy)
        const rows = history[t.slug] ?? []
        const changes = pending[t.slug] ?? []
        const inFlight = t.inFlight
        return (
          <Collapsible
            actions={
              <Pill pillStyle={p.pillStyle} size="small">
                {p.text}
              </Pill>
            }
            header={
              <span style={{ fontWeight: 600 }}>
                {t.label} <span style={{ color: 'var(--theme-elevation-500)', fontWeight: 400 }}>· {t.slug}</span>
              </span>
            }
            key={t.slug}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--base)' }}>
              {!t.configured && <Banner type="info">{t.missing ?? 'Deploy hook URL is not set'} — set the environment variable for this target and restart.</Banner>}
              {t.lastError && <Banner type="error">Vercel API: {t.lastError}</Banner>}

              {/* Current strip */}
              <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 'calc(var(--base) / 2)' }}>
                {t.current ? (
                  <span>
                    Live: <Pill pillStyle={statePillStyle(t.current.state)} size="small">{stateLabel(t.current.state)}</Pill>{' '}
                    <span style={{ color: 'var(--theme-elevation-500)' }}>
                      {relativeTime(t.current.readyAt ?? t.current.createdAt, now)} · {causeLabel(t.current.cause)}
                      {t.current.triggeredBy ? ` by ${userLabel(t.current.triggeredBy)}` : ''}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--theme-elevation-500)' }}>No deployment recorded yet.</span>
                )}
                <span style={{ flex: 1 }} />
                {t.url && (
                  <Button buttonStyle="secondary" el="anchor" newTab size="small" url={t.url}>
                    Open site
                  </Button>
                )}
                {(inFlight?.inspectorUrl ?? t.current?.inspectorUrl) && (
                  <Button buttonStyle="secondary" el="anchor" newTab size="small" url={inFlight?.inspectorUrl ?? t.current?.inspectorUrl ?? ''}>
                    Inspect on Vercel
                  </Button>
                )}
                {permissions.deploy && t.configured && (
                  <Button
                    buttonStyle="secondary"
                    disabled={busy !== null}
                    onClick={() => void run(`pause-${t.slug}`, () => vercelApi.pause(apiRoute, t.slug, !t.paused), t.paused ? 'Automatic deployments resumed' : 'Automatic deployments paused')}
                    size="small"
                  >
                    {t.paused ? 'Resume auto-deploy' : 'Pause auto-deploy'}
                  </Button>
                )}
                {permissions.rollback && t.tokenConfigured && inFlight?.deploymentId && (
                  <Button
                    buttonStyle="error"
                    disabled={busy !== null}
                    onClick={() => void run(`cancel-${t.slug}`, () => vercelApi.cancel(apiRoute, inFlight.deploymentId!), 'Deployment canceled')}
                    size="small"
                  >
                    Cancel build
                  </Button>
                )}
                {permissions.rollback && t.tokenConfigured && t.current?.state === 'ready' && (
                  <Button buttonStyle="secondary" disabled={busy !== null} onClick={() => void openRollback(t)} size="small">
                    Roll back…
                  </Button>
                )}
              </div>

              <div style={{ color: 'var(--theme-elevation-500)', fontSize: '12px' }}>
                {t.triggersLastHour}/60 hook calls this hour · last tick {relativeTime(t.lastTickAt, now)}
                {t.lastTickSource ? ` (${t.lastTickSource})` : ''}
                {!t.tokenConfigured && ' · no token: status, cancel and rollback unavailable'}
              </div>

              {/* Pending changes */}
              <div>
                <h3 style={{ margin: '0 0 calc(var(--base) / 2)' }}>
                  Pending changes{t.pendingCount ? ` (${t.pendingCount})` : ''}
                </h3>
                {changes.length === 0 ? (
                  <Banner type="default">Nothing is waiting — the site is up to date with the content.</Banner>
                ) : (
                  <Table
                    appearance="condensed"
                    columns={columns(changes, [
                      { accessor: 'title', heading: 'Title', render: (c) => <span>{c.title}</span> },
                      { accessor: 'where', heading: 'Where', render: (c) => <span>{c.global ? `global · ${c.global}` : c.collection}</span> },
                      { accessor: 'operation', heading: 'Change', render: (c) => <span>{c.operation}{c.saves > 1 ? ` ×${c.saves}` : ''}</span> },
                      { accessor: 'changedAt', heading: 'When', render: (c) => <span>{relativeTime(c.changedAt, now)}</span> },
                    ])}
                    data={changes as unknown as Record<string, unknown>[]}
                  />
                )}
              </div>

              {/* History */}
              <div>
                <h3 style={{ margin: '0 0 calc(var(--base) / 2)' }}>History</h3>
                {rows.length === 0 ? (
                  <Banner type="default">No deployments yet — press Deploy to build the site for the first time.</Banner>
                ) : (
                  <Table
                    appearance="condensed"
                    columns={columns(rows, [
                      { accessor: 'createdAt', heading: 'When', render: (r) => <span title={r.createdAt}>{relativeTime(r.createdAt, now)}</span> },
                      {
                        accessor: 'cause',
                        heading: 'Cause',
                        render: (r) => (
                          <span>
                            {causeLabel(r.cause)}
                            {r.triggeredBy ? <span style={{ color: 'var(--theme-elevation-500)' }}> · {userLabel(r.triggeredBy)}</span> : null}
                            {r.reason ? <div style={{ color: 'var(--theme-elevation-500)', fontSize: '12px' }}>{r.reason}</div> : null}
                          </span>
                        ),
                      },
                      {
                        accessor: 'state',
                        heading: 'State',
                        render: (r) => (
                          <span>
                            <Pill pillStyle={statePillStyle(r.state)} size="small">
                              {r.supersededBy ? 'Superseded' : stateLabel(r.state)}
                            </Pill>
                            {r.state === 'error' && r.errorMessage ? <div style={{ color: 'var(--theme-error-500)', fontSize: '12px', maxWidth: '360px' }}>{r.errorCode ? `${r.errorCode}: ` : ''}{r.errorMessage}</div> : null}
                          </span>
                        ),
                      },
                      { accessor: 'durationMs', heading: 'Duration', render: (r) => <span>{typeof r.durationMs === 'number' ? formatDuration(r.durationMs) : '—'}</span> },
                      {
                        accessor: 'changeCount',
                        heading: 'Changes',
                        render: (r) =>
                          r.changeCount > 0 ? (
                            <Button
                              buttonStyle="none"
                              onClick={() => {
                                setChangesFor(r)
                                openModal(CHANGES_DRAWER)
                              }}
                              size="small"
                            >
                              {r.changeCount}
                            </Button>
                          ) : (
                            <span>—</span>
                          ),
                      },
                      {
                        accessor: 'links',
                        heading: '',
                        render: (r) => (
                          <span style={{ display: 'inline-flex', gap: 'calc(var(--base) / 4)' }}>
                            {r.deploymentUrl && (
                              <Button buttonStyle="none" el="anchor" newTab size="small" url={r.deploymentUrl}>
                                Open
                              </Button>
                            )}
                            {r.inspectorUrl && (
                              <Button buttonStyle="none" el="anchor" newTab size="small" url={r.inspectorUrl}>
                                Inspect
                              </Button>
                            )}
                            {permissions.rollback && t.tokenConfigured && (['triggered', 'queued', 'building'].includes(r.state) && r.deploymentId || (r.state === 'ready' && r.environment === 'production' && r.deploymentId && r.deploymentId !== t.current?.deploymentId)) ? (
                              <Popup
                                button={<span style={{ cursor: 'pointer' }}>⋯</span>}
                                buttonType="custom"
                                horizontalAlign="right"
                                render={({ close }) => (
                                  <PopupList.ButtonGroup>
                                    {['triggered', 'queued', 'building'].includes(r.state) && r.deploymentId ? (
                                      <PopupList.Button
                                        onClick={() => {
                                          close()
                                          void run(`cancel-${r.id}`, () => vercelApi.cancel(apiRoute, r.deploymentId!), 'Deployment canceled')
                                        }}
                                      >
                                        Cancel build
                                      </PopupList.Button>
                                    ) : null}
                                    {r.state === 'ready' && r.environment === 'production' && r.deploymentId && r.deploymentId !== t.current?.deploymentId ? (
                                      <PopupList.Button
                                        onClick={() => {
                                          close()
                                          void run(`rollback-${r.id}`, () => vercelApi.rollback(apiRoute, t.slug, r.deploymentId!), `Rolled back to ${r.deploymentId}`)
                                        }}
                                      >
                                        Roll back to this
                                      </PopupList.Button>
                                    ) : null}
                                  </PopupList.ButtonGroup>
                                )}
                                size="small"
                              />
                            ) : null}
                          </span>
                        ),
                      },
                    ])}
                    data={rows as unknown as Record<string, unknown>[]}
                  />
                )}
              </div>
            </div>
          </Collapsible>
        )
      })}

      {/* Setup */}
      <Collapsible header={<span style={{ fontWeight: 600 }}>Setup</span>} initCollapsed>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {targets.map((t) => (
            <li key={t.slug} style={{ padding: '4px 0' }}>
              <strong>{t.label}</strong>: deploy hook {t.configured ? 'set' : 'NOT set'} · token {t.tokenConfigured ? 'set' : 'not set'}
              {t.projectId ? ` · project ${t.projectId}` : ''}
            </li>
          ))}
          <li style={{ padding: '4px 0' }}>Webhook endpoint: {initial.setup.webhook ? 'enabled (POST /api/vercel/webhook)' : 'disabled — set webhookSecret to enable'}</li>
          <li style={{ padding: '4px 0' }}>Admin heartbeat: {initial.setup.heartbeat ? 'on' : 'off'} · scheduled task: {initial.setup.tickJob ? `${initial.setup.tickJob.cron} on queue "${initial.setup.tickJob.queue}"` : 'off'}</li>
          <li style={{ padding: '4px 0' }}>Automatic deploys: {initial.autoDeploy ? `${Math.round(initial.autoDeploy.quietPeriodMs / 1000)} s quiet period, ${Math.round(initial.autoDeploy.maxWaitMs / 60_000)} min max wait` : 'off'}</li>
          <li style={{ padding: '4px 0' }}>Vercel API: {initial.setup.apiBase}</li>
        </ul>
      </Collapsible>

      <DeployDrawer apiRoute={apiRoute} autoDeploy={autoDeploy} now={now} onDeployed={() => void reloadLists()} slug={VIEW_DEPLOY_DRAWER} targets={targets} />

      <Drawer slug={CHANGES_DRAWER} title={changesFor ? `Changes in deployment ${changesFor.deploymentId ?? `#${changesFor.id}`}` : 'Changes'}>
        {changesFor?.changes ? (
          <div>
            <p style={{ color: 'var(--theme-elevation-500)' }}>
              {Object.entries(changesFor.changes.counts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
              {changesFor.changeCount > changesFor.changes.items.length ? ` · first ${changesFor.changes.items.length} of ${changesFor.changeCount} listed` : ''}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {changesFor.changes.items.map((item, i) => (
                <li key={i} style={{ borderBottom: '1px solid var(--theme-elevation-100)', display: 'flex', gap: '8px', padding: '4px 0' }}>
                  <span style={{ flex: 1 }}>{item.t}</span>
                  <span style={{ color: 'var(--theme-elevation-500)', fontSize: '12px' }}>
                    {item.g ? `global · ${item.g}` : item.c} · {item.op}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Banner type="default">No change details were recorded for this deployment.</Banner>
        )}
      </Drawer>

      <Drawer slug={ROLLBACK_DRAWER} title={rollbackFor ? `Roll back ${rollbackFor.target.label}` : 'Roll back'}>
        {!rollbackFor ? null : rollbackFor.loading ? (
          <p>Loading previous production deployments…</p>
        ) : rollbackFor.candidates.length === 0 ? (
          <Banner type="info">Vercel reports no previous production deployment that can be restored.</Banner>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--base) / 2)' }}>
            <p style={{ color: 'var(--theme-elevation-500)', margin: 0 }}>
              Instant rollback points production traffic at an earlier build. Content changed since then goes back to pending.
            </p>
            {rollbackFor.candidates.map((c) => {
              const id = c.uid ?? c.id ?? ''
              return (
                <div key={id} style={{ alignItems: 'center', borderBottom: '1px solid var(--theme-elevation-100)', display: 'flex', gap: '8px', padding: '6px 0' }}>
                  <span style={{ flex: 1 }}>
                    <code>{id}</code>
                    <div style={{ color: 'var(--theme-elevation-500)', fontSize: '12px' }}>
                      {c.created ? relativeTime(new Date(c.created).toISOString(), now) : ''}
                      {c.url ? ` · ${c.url}` : ''}
                    </div>
                  </span>
                  <Button
                    buttonStyle="secondary"
                    disabled={busy !== null}
                    onClick={() => void run(`rollback-${id}`, () => vercelApi.rollback(apiRoute, rollbackFor.target.slug, id), `Rolled back to ${id}`)}
                    size="small"
                  >
                    Roll back to this
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Drawer>
    </div>
  )
}
