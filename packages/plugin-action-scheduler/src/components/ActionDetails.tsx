'use client'

import { Pill, ShimmerEffect, useConfig, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

import type { ScheduledAction, ScheduledActionLog } from '../types.js'
import type { Row } from './shared.js'

import { formatDuration } from '../utils/duration.js'
import { apiBase, call } from './api.js'
import { RowActions } from './RowActions.js'
import { REFRESH_EVENT, failureWords, fullTime, isRecurring, localTime, relative, scheduleWords, statusLabel } from './shared.js'
import './styles.scss'

type Details = {
  action: ScheduledAction
  definition: { description: null | string; label: null | string; registered: boolean }
  logs: ScheduledActionLog[]
  maxArgsBytes: number
  trimmed: boolean
}

const ICONS: Record<string, [string, string]> = {
  canceled: ['–', ''],
  completed: ['✓', 'ok'],
  dispatched: ['·', ''],
  failed: ['✕', 'err'],
  lost: ['?', 'err'],
  note: ['i', ''],
  rearmed: ['↻', ''],
  rescheduled: ['→', ''],
  retry: ['↻', 'warn'],
  scheduled: ['·', ''],
  skipped: ['↷', 'ok'],
  started: ['▸', ''],
  timeout: ['⏱', 'err'],
}

export function useActionDetails(collectionSlug: string, id: null | number | string) {
  const { config } = useConfig()
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<null | string>(null)
  const load = useCallback(async () => {
    if (id === null || id === undefined) {
      return
    }
    const { body, ok } = await call<Details & { message?: string }>(`${apiBase(config, collectionSlug)}/${id}/logs`)
    if (ok) {
      setDetails(body)
      setError(null)
    } else {
      setError(body.message ?? 'Could not load this action')
    }
  }, [collectionSlug, config, id])
  useEffect(() => {
    setDetails(null)
    void load()
    const onRefresh = () => void load()
    window.addEventListener(REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh)
  }, [load])
  return { details, error, reload: load }
}

export const ActionDetails: React.FC<{ collectionSlug: string; id: number | string; showActions?: boolean; showHeader?: boolean }> = ({
  collectionSlug,
  id,
  showActions = true,
  showHeader = true,
}) => {
  const { details, error, reload } = useActionDetails(collectionSlug, id)
  if (error) {
    return <p className="pas-drawer__section">{error}</p>
  }
  if (!details) {
    return (
      <div className="pas-drawer__section">
        <ShimmerEffect height="20px" />
      </div>
    )
  }
  const { action, definition, logs, maxArgsBytes, trimmed } = details
  const bytes = new TextEncoder().encode(JSON.stringify(action.args ?? {})).length
  const sched = scheduleWords(action)
  const showError = action.errorMessage && (action.status === 'failed' || (action.status === 'pending' && action.lastOutcome && action.lastOutcome !== 'completed'))
  const facts: [string, React.ReactNode][] = [
    [
      'Status',
      <>
        <Pill pillStyle={action.status === 'complete' ? 'success' : action.status === 'failed' ? 'error' : 'light-gray'} size="small">
          {statusLabel(action.status)}
        </Pill>
        {action.status === 'failed' ? ` ${failureWords(action.failureReason)}` : null}
      </>,
    ],
    ['Schedule', <>{sched.words}{sched.raw ? <> <code>{sched.raw}</code></> : null}{action.tz ? ` · ${action.tz}` : ''}</>],
    ['Next / When', <span title={fullTime(action.scheduleAt)}>{localTime(action.scheduleAt)} · {relative(action.scheduleAt)}</span>],
    ['Attempts', `${action.attempts} of ${action.maxAttempts}`],
    ...(isRecurring(action) ? [['Runs', `${action.runCount ?? 0}${action.stopAfterCurrent ? ' · stops after this run' : ''}`] as [string, React.ReactNode]] : []),
    ['Group', action.group],
    ['Queue', action.queue],
    ['Priority', `${action.priority} (lower runs first)`],
    ['Created', `${localTime(action.createdAt)} · ${action.source === 'admin' ? `in the admin${action.createdBy ? ` by ${action.createdBy}` : ''}` : action.source === 'series' ? 'code series (payload.config.ts)' : 'from code'}`],
  ]
  return (
    <div>
      {showHeader ? (
        <div className="pas-drawer__section">
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 16, margin: 0 }}>{action.hook}</h2>
          <div style={{ color: 'var(--theme-elevation-600)', marginTop: 4 }}>
            #{String(action.id)} · {definition.registered ? (definition.label ?? definition.description ?? 'Registered in code') : 'Not registered in code'}
          </div>
        </div>
      ) : null}
      <section className="pas-drawer__section">
        <dl className="pas-drawer__facts">
          {facts.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>
      {showError ? (
        <section className="pas-drawer__section">
          <h3>Last error</h3>
          <div className="pas-drawer__error">
            <div>{action.errorMessage}</div>
            {action.errorStack ? (
              <details>
                <summary>Show stack</summary>
                <pre>{action.errorStack}</pre>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}
      <section className="pas-drawer__section">
        <h3>Arguments</h3>
        {bytes > 2 ? <pre className="pas-drawer__json">{JSON.stringify(action.args, null, 2)}</pre> : <div style={{ color: 'var(--theme-elevation-600)' }}>No arguments</div>}
        <div className="pas-drawer__meter">
          <span>
            <i style={{ width: `${Math.max(2, (bytes / maxArgsBytes) * 100)}%` }} />
          </span>
          <span>
            {bytes} B of {Math.round(maxArgsBytes / 1024)} KB
          </span>
        </div>
      </section>
      <section className="pas-drawer__section">
        <h3>Log · newest first</h3>
        {logs.length ? (
          <ol className="pas-drawer__timeline">
            {logs.map((line) => {
              const [icon, tone] = ICONS[line.event] ?? ['·', '']
              const meta = [line.attempt ? `attempt ${line.attempt}` : '', line.durationMs != null ? formatDuration(line.durationMs) : ''].filter(Boolean).join(' · ')
              return (
                <li key={String(line.id)}>
                  <span aria-hidden="true" className={`pas-drawer__icon ${tone ? `pas-drawer__icon--${tone}` : ''}`}>
                    {icon}
                  </span>
                  <div>
                    <div>{line.message}</div>
                    {meta ? <small>{meta}</small> : null}
                  </div>
                  <time dateTime={line.createdAt} title={fullTime(line.createdAt)}>
                    {relative(line.createdAt)}
                  </time>
                </li>
              )
            })}
          </ol>
        ) : (
          <div style={{ color: 'var(--theme-elevation-600)' }}>No log lines yet.</div>
        )}
        {trimmed ? <div className="pas-drawer__trim">Older lines were trimmed · keeps the newest {logs.length}</div> : null}
      </section>
      {showActions ? <RowActions collectionSlug={collectionSlug} layout="buttons" onChanged={() => void reload()} row={action as Row} /> : null}
    </div>
  )
}

/** The `timeline` ui field at the top of the edit view. */
export const ActionTimelineField: React.FC = () => {
  const { collectionSlug, id } = useDocumentInfo()
  if (!id || !collectionSlug) {
    return null
  }
  return <ActionDetails collectionSlug={collectionSlug} id={id} showActions={false} showHeader={false} />
}
