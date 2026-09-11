'use client'

import type { DefaultCellComponentProps } from 'payload'

import { Pill, useConfig } from '@payloadcms/ui'
import React from 'react'

import type { Row } from './shared.js'

import { availableActions, failureWords, fullTime, isPastDue, isRecurring, lastResult, localTime, openActionDrawer, relative, scheduleWords, spanText, statusLabel } from './shared.js'
import './styles.scss'

type CellProps = DefaultCellComponentProps<any, any> & { rowData: Row }

const cls = 'pas-cell'

export const ActionCell: React.FC<CellProps> = ({ collectionSlug, rowData }) => {
  const { config } = useConfig()
  const href = `${config.routes.admin}/collections/${collectionSlug}/${rowData.id}`
  const parts = [rowData.group || 'default']
  if (isRecurring(rowData)) {
    parts.push(rowData.source === 'series' ? '↻ series' : '↻ recurring')
  }
  return (
    <div className={cls}>
      <a className={`${cls}__hook`} href={href}>
        {rowData.hook}
      </a>
      <span className={`${cls}__line2`}>{parts.join(' · ')}</span>
    </div>
  )
}

export const StatusCell: React.FC<CellProps> = ({ rowData }) => {
  const status = rowData.status
  const pillStyle = status === 'complete' ? 'success' : status === 'failed' ? 'error' : status === 'running' ? 'dark' : status === 'canceled' ? 'white' : 'light-gray'
  let line2: null | string = null
  if (status === 'running' && rowData.lastAttemptAt) {
    line2 = `${spanText(Date.now() - new Date(rowData.lastAttemptAt).getTime())} elapsed`
  } else if (status === 'failed') {
    line2 = failureWords(rowData.failureReason)
  } else if (status === 'pending' && (rowData.attempts ?? 0) > 0) {
    line2 = 'retrying'
  }
  return (
    <div className={cls}>
      <span className={`${cls}__pills`}>
        <Pill pillStyle={pillStyle} size="small">
          {status === 'running' ? <span className={`${cls}__dot`} aria-hidden="true" /> : null}
          {statusLabel(status)}
        </Pill>
        {isPastDue(rowData) ? (
          <Pill pillStyle="warning" size="small">
            past due
          </Pill>
        ) : null}
      </span>
      {line2 ? <span className={`${cls}__line2`}>{line2}</span> : null}
    </div>
  )
}

export const ScheduleCell: React.FC<CellProps> = ({ rowData }) => {
  const { raw, tz, words } = scheduleWords(rowData)
  return (
    <div className={cls}>
      <span>{words}</span>
      {raw ? (
        <span className={`${cls}__raw`} title={tz ? `Evaluated in ${tz}` : 'Cron expression'}>
          {raw}
          {tz ? ` · ${tz}` : ''}
        </span>
      ) : null}
    </div>
  )
}

export const WhenCell: React.FC<CellProps> = ({ rowData }) => {
  const now = Date.now()
  const status = rowData.status
  const t = rowData.scheduleAt
  let main = ''
  let line2 = ''
  let warn = false
  if (status === 'running') {
    main = `Started ${relative(rowData.lastAttemptAt, now)}`
  } else if (status === 'pending' && t) {
    const ts = new Date(t).getTime()
    main = localTime(t)
    if (ts < now - 60_000) {
      line2 = `${spanText(now - ts)} overdue`
      warn = true
    } else if (ts <= now) {
      line2 = 'due now'
    } else {
      line2 = `in ${spanText(ts - now)}`
    }
  } else {
    const c = rowData.completedAt ?? t
    main = `${statusLabel(status)} ${localTime(c)}`
    line2 = relative(c, now)
  }
  return (
    <div className={cls}>
      <time dateTime={t ? new Date(t).toISOString() : undefined} title={fullTime(rowData.completedAt ?? t)}>
        {main}
      </time>
      {line2 ? <span className={`${cls}__line2 ${warn ? `${cls}__line2--warn` : ''}`}>{line2}</span> : null}
    </div>
  )
}

export const AttemptsCell: React.FC<CellProps> = ({ rowData }) => (
  <div className={`${cls} ${cls}--num`}>
    <span>{rowData.attempts ? `${rowData.attempts}/${rowData.maxAttempts ?? '?'}` : '—'}</span>
    {isRecurring(rowData) ? <span className={`${cls}__line2`}>run {(rowData.runCount ?? 0).toLocaleString()}</span> : null}
  </div>
)

export const LastResultCell: React.FC<CellProps> = ({ rowData }) => {
  const result = lastResult(rowData)
  if (!result) {
    return <span className={`${cls} ${cls}__muted`}>—</span>
  }
  return (
    <button className={`${cls} ${cls}__result`} onClick={() => openActionDrawer(rowData.id)} type="button">
      <span className={result.error ? `${cls}__error` : undefined}>{result.text}</span>
      <span className={`${cls}__line2`}>view log</span>
    </button>
  )
}

export const ArgsCell: React.FC<CellProps> = ({ rowData }) => {
  const json = JSON.stringify(rowData.args ?? {})
  if (json === '{}') {
    return <span className={`${cls} ${cls}__muted`}>—</span>
  }
  return (
    <code className={`${cls}__args`} title={JSON.stringify(rowData.args, null, 2)}>
      {json}
    </code>
  )
}

export { availableActions }
