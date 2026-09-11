'use client'

import type { Where } from 'payload'

import { Banner, Button, Drawer, DrawerContentContainer, PillSelector, toast, useConfig, useListQuery, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { CountsPayload, StatusPayload } from '../endpoints/index.js'
import type { RunQueueResult } from '../types.js'

import { formatDuration } from '../utils/duration.js'
import { ActionDetails } from './ActionDetails.js'
import { apiBase, call } from './api.js'
import { DRAWER_SLUG, localTime, OPEN_EVENT, REFRESH_EVENT, relative, spanText } from './shared.js'
import './styles.scss'

export type ListHeaderProps = {
  collectionSlug: string
  initial: { counts: CountsPayload; status: StatusPayload }
  tickEnabled: boolean
}

type TabKey = keyof CountsPayload
const TABS: [TabKey, string][] = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['running', 'Running'],
  ['pastdue', 'Past due'],
  ['failed', 'Failed'],
  ['complete', 'Completed'],
  ['canceled', 'Canceled'],
]

const TAB_MARKER = 'scheduler_tab'

function whereForTab(tab: TabKey): undefined | Where {
  switch (tab) {
    case 'all':
      return undefined
    case 'pastdue':
      return { and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than: new Date(Date.now() - 60_000).toISOString() } }] }
    default:
      return { status: { equals: tab } }
  }
}

function tabFromWhere(where: unknown): TabKey {
  const text = JSON.stringify(where ?? {})
  if (!text || text === '{}') {
    return 'all'
  }
  if (text.includes('"scheduleAt"') && text.includes('"pending"')) {
    return 'pastdue'
  }
  for (const [key] of TABS) {
    if (key !== 'all' && key !== 'pastdue' && text.includes(`"${key}"`) && text.includes('"status"')) {
      return key
    }
  }
  return 'all'
}

export const ListHeader: React.FC<ListHeaderProps> = ({ collectionSlug, initial, tickEnabled }) => {
  const { config } = useConfig()
  const { query, refineListData } = useListQuery()
  const { closeModal, openModal } = useModal()
  const router = useRouter()
  const base = apiBase(config, collectionSlug)
  const [status, setStatus] = useState<StatusPayload>(initial.status)
  const [counts, setCounts] = useState<CountsPayload>(initial.counts)
  const [running, setRunning] = useState(false)
  const [drawerId, setDrawerId] = useState<null | number | string>(null)
  const [, setTick] = useState(0)
  const timer = useRef<null | ReturnType<typeof setInterval>>(null)

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([call<StatusPayload>(`${base}/scheduler/status`), call<CountsPayload>(`${base}/scheduler/counts`)])
    if (s.ok) {
      setStatus(s.body)
    }
    if (c.ok) {
      setCounts(c.body)
    }
  }, [base])

  // Adaptive polling: fast while something is running or due soon, slow otherwise, paused when hidden.
  useEffect(() => {
    const schedule = () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
      const soon = status.nextDue ? new Date(status.nextDue).getTime() - Date.now() < 5 * 60_000 : false
      const fast = running || counts.running > 0 || soon || status.pastDue > 0
      timer.current = setInterval(() => {
        if (document.hidden) {
          return
        }
        setTick((t) => t + 1)
        void refresh()
      }, fast ? 5_000 : 30_000)
    }
    schedule()
    const onRefresh = () => void refresh()
    window.addEventListener(REFRESH_EVENT, onRefresh)
    return () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
      window.removeEventListener(REFRESH_EVENT, onRefresh)
    }
  }, [counts.running, refresh, running, status.nextDue, status.pastDue])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<{ id: number | string }>).detail?.id
      if (id !== undefined) {
        setDrawerId(id)
        openModal(DRAWER_SLUG)
      }
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [openModal])

  const activeTab = useMemo(() => tabFromWhere(query?.where), [query?.where])

  const selectTab = useCallback(
    async (tab: TabKey) => {
      const where = whereForTab(tab)
      const sort = tab === 'pending' || tab === 'pastdue' ? 'scheduleAt' : '-updatedAt'
      await refineListData({ page: 1, sort, where: where as never }, true)
    },
    [refineListData],
  )

  const runQueue = useCallback(async () => {
    setRunning(true)
    try {
      const { body, ok, status: code } = await call<RunQueueResult & { message?: string }>(`${base}/scheduler/run-queue`, { body: '{}', method: 'POST' })
      if (!ok) {
        toast.error(body.message ?? (code === 409 ? 'A run is already in progress' : 'Could not run the queue'))
      } else if (body.ran === 0) {
        toast.info('Nothing was due. The queue is up to date.')
      } else {
        const summary = `Ran ${body.ran} · ${body.completed} completed · ${body.failed} failed`
        if (body.failed > 0) {
          toast.error(summary, { action: { label: 'Show failed', onClick: () => void selectTab('failed') } })
        } else {
          toast.success(summary)
        }
      }
      await refresh()
      router.refresh()
    } finally {
      setRunning(false)
    }
  }, [base, refresh, router, selectTab])

  const lastRun = status.lastRun
  const lockedByOther = status.runLock && !running
  const health = tickEnabled ? status.health : 'unknown'

  return (
    <div className="pas-header">
      <div className="pas-header__strip">
        <Button buttonStyle="primary" disabled={running || Boolean(lockedByOther)} onClick={() => void runQueue()} size="small" tooltip={lockedByOther ? `A run started by ${status.runLock?.user ?? 'someone else'} is in progress` : undefined}>
          {running ? 'Running…' : 'Run queue'}
        </Button>
        <div className="pas-header__summary">
          {lastRun ? (
            <>
              <span>
                Last run <b title={lastRun.startedAt}>{relative(lastRun.startedAt)}</b>
              </span>
              <span>{lastRun.trigger === 'manual' ? `by ${lastRun.user ?? 'an admin'}` : lastRun.trigger === 'clock' ? 'via Payload Clock' : 'via runner'}</span>
              <span>
                ran <b>{lastRun.ran}</b>
              </span>
              <span className={lastRun.failed ? 'is-bad' : undefined}>{lastRun.failed} failed</span>
              <span>{formatDuration(lastRun.durationMs)}</span>
            </>
          ) : (
            <span>No runs recorded yet</span>
          )}
        </div>
        <div className="pas-header__right">
          {status.nextDue ? (
            <span>
              Next due <b style={{ color: 'var(--theme-text)', fontWeight: 500 }}>{localTime(status.nextDue)}</b> ({relative(status.nextDue)})
            </span>
          ) : null}
          <span className="pas-header__health" title={status.lastTickAt ? `Last maintenance tick ${relative(status.lastTickAt)}` : undefined}>
            <span className={`pas-header__dot ${health === 'healthy' ? 'pas-header__dot--ok' : health === 'stale' ? 'pas-header__dot--warn' : ''}`} />
            {health === 'healthy' ? 'Runner active' : health === 'stale' ? 'Runner stale' : health === 'never' ? 'No runner yet' : 'Runner status unknown'}
          </span>
        </div>
      </div>
      {health === 'stale' ? (
        <Banner type="error">
          <b>Nothing has run the queue for {status.lastTickAt ? spanText(Date.now() - new Date(status.lastTickAt).getTime()) : 'a while'}.</b>{' '}
          {status.pastDue ? `${status.pastDue} action${status.pastDue === 1 ? ' is' : 's are'} past due. ` : ''}
          Check the cron job or worker that calls <code>/api/payload-jobs/run</code>, or run the queue now.
        </Banner>
      ) : null}
      {health === 'never' ? (
        <Banner type="info">
          <b>Actions run when something runs the Payload job queue.</b> Nothing has yet. Pick the runner that matches your hosting:
          <div className="pas-header__snips">
            <code>{"jobs.autoRun: [{ cron: '* * * * *' }]"}</code>
            <code>Vercel cron → GET /api/payload-jobs/run</code>
            <code>Payload Clock</code>
          </div>
        </Banner>
      ) : null}
      <div aria-label="Filter by status" className="pas-header__tabs" role="tablist">
        <PillSelector
          onClick={({ pill }) => void selectTab(pill.name as TabKey)}
          pills={TABS.map(([key, label]) => {
            const n = counts[key]
            const tone = n === 0 ? 'zero' : key === 'pastdue' ? 'warn' : key === 'failed' ? 'err' : ''
            return {
              Label: (
                <>
                  {label} <span className={`pas-header__count ${tone ? `pas-header__count--${tone}` : ''}`}>{n.toLocaleString()}</span>
                </>
              ),
              name: key,
              selected: activeTab === key,
            }
          })}
        />
      </div>
      <Drawer slug={DRAWER_SLUG} title="Scheduled action">
        <DrawerContentContainer>
          {drawerId !== null ? <ActionDetails collectionSlug={collectionSlug} id={drawerId} key={String(drawerId)} /> : null}
          <div className="pas-drawer__footer">
            <Button buttonStyle="secondary" onClick={() => closeModal(DRAWER_SLUG)} size="small">
              Close
            </Button>
            {drawerId !== null ? (
              <Button buttonStyle="subtle" el="link" size="small" to={`${config.routes.admin}/collections/${collectionSlug}/${drawerId}`}>
                Open full page →
              </Button>
            ) : null}
          </div>
        </DrawerContentContainer>
      </Drawer>
    </div>
  )
}

export { TAB_MARKER }
