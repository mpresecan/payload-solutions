'use client'

import type { DefaultCellComponentProps } from 'payload'

import { Button, ConfirmationModal, Popup, PopupList, toast, useConfig, useDocumentInfo, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import React, { useCallback, useState } from 'react'

import type { Row } from './shared.js'

import { apiBase, call } from './api.js'
import { availableActions, openActionDrawer, requestRefresh } from './shared.js'
import './styles.scss'

type Props = {
  collectionSlug: string
  /** 'menu' renders the ⋯ popup used in list rows; 'buttons' renders inline buttons (drawer footer, edit view). */
  layout: 'buttons' | 'menu'
  onChanged?: () => void
  row: Row
}

type Confirmable = 'cancel' | 'delete' | 'stop-after-current'

export const RowActions: React.FC<Props> = ({ collectionSlug, layout, onChanged, row }) => {
  const { config } = useConfig()
  const { openModal } = useModal()
  const router = useRouter()
  const [busy, setBusy] = useState<null | string>(null)
  const [rescheduleAt, setRescheduleAt] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<Confirmable | null>(null)
  const base = apiBase(config, collectionSlug)
  const confirmSlug = `pas-confirm-${layout}-${row.id}`
  const rescheduleSlug = `pas-reschedule-${layout}-${row.id}`

  const done = useCallback(() => {
    requestRefresh()
    router.refresh()
    onChanged?.()
  }, [onChanged, router])

  const run = useCallback(
    async (key: string, body?: Record<string, unknown>) => {
      setBusy(key)
      try {
        if (key === 'delete') {
          const { body: res, ok } = await call<{ message?: string }>(`${base}/${row.id}`, { method: 'DELETE' })
          toast[ok ? 'success' : 'error'](ok ? `Deleted #${row.id}` : (res.message ?? 'Could not delete'))
        } else if (key === 'duplicate') {
          const { body: res, ok } = await call<{ id?: number | string; message?: string }>(`${base}/${row.id}/duplicate`, { method: 'POST' })
          if (ok && res.id) {
            toast.success(res.message ?? 'Duplicated')
            router.push(`${config.routes.admin}/collections/${collectionSlug}/${res.id}`)
            return
          }
          toast.error(res.message ?? 'Could not duplicate')
        } else {
          const { body: res, ok, status } = await call<{ message?: string }>(`${base}/${row.id}/${key}`, { body: JSON.stringify(body ?? {}), method: 'POST' })
          if (ok) {
            toast.success(`${row.hook}: ${res.message ?? 'done'}`)
          } else {
            toast.error(res.message ?? (status === 409 ? 'Not possible in this state' : 'Failed'))
          }
        }
        done()
      } finally {
        setBusy(null)
      }
    },
    [base, collectionSlug, config.routes.admin, done, router, row.hook, row.id],
  )

  const onPick = (key: string) => {
    if (key === 'cancel' || key === 'delete' || key === 'stop-after-current') {
      setPendingConfirm(key)
      openModal(confirmSlug)
      return
    }
    if (key === 'reschedule') {
      const d = new Date(Date.now() + 30 * 60_000)
      d.setSeconds(0, 0)
      setRescheduleAt(new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
      openModal(rescheduleSlug)
      return
    }
    void run(key)
  }

  const actions = availableActions(row)
  const confirmCopy: Record<Confirmable, { body: string; confirm: string; heading: string }> = {
    cancel: {
      body: `${row.hook} will not run. Its history is kept.`,
      confirm: row.source === 'series' ? 'Pause' : 'Cancel action',
      heading: row.source === 'series' ? 'Pause this series?' : 'Cancel this action?',
    },
    delete: { body: 'The row and its log are removed permanently.', confirm: 'Delete', heading: `Delete #${row.id}?` },
    'stop-after-current': { body: 'The current run finishes; no further runs are scheduled.', confirm: 'Stop', heading: 'Stop after this run?' },
  }

  const modals = (
    <>
      {pendingConfirm ? (
        <ConfirmationModal
          body={confirmCopy[pendingConfirm].body}
          confirmLabel={confirmCopy[pendingConfirm].confirm}
          heading={confirmCopy[pendingConfirm].heading}
          modalSlug={confirmSlug}
          onConfirm={() => run(pendingConfirm)}
        />
      ) : null}
      <ConfirmationModal
        body={
          <div className="field-type">
            <label className="field-label" htmlFor={`${rescheduleSlug}-input`}>
              New date and time
            </label>
            <input
              id={`${rescheduleSlug}-input`}
              onChange={(e) => setRescheduleAt(e.target.value)}
              style={{ width: '100%' }}
              type="datetime-local"
              value={rescheduleAt}
            />
          </div>
        }
        confirmLabel="Reschedule"
        heading={`Reschedule ${row.hook}`}
        modalSlug={rescheduleSlug}
        onConfirm={() => run('reschedule', { scheduleAt: new Date(rescheduleAt).toISOString() })}
      />
    </>
  )

  if (layout === 'buttons') {
    return (
      <div className="pas-drawer__footer">
        {actions.map((a) => (
          <Button
            buttonStyle={a.primary ? 'primary' : a.danger ? 'error' : 'secondary'}
            disabled={busy !== null}
            key={a.key}
            onClick={() => onPick(a.key)}
            size="small"
          >
            {busy === a.key ? '…' : a.label}
          </Button>
        ))}
        {modals}
      </div>
    )
  }

  return (
    <>
      <Popup
        button={<span aria-label={`Actions for ${row.hook}`}>⋯</span>}
        buttonType="default"
        horizontalAlign="right"
        render={({ close }) => (
          <PopupList.ButtonGroup>
            {actions.map((a) => (
              <PopupList.Button
                disabled={busy !== null}
                key={a.key}
                onClick={() => {
                  close()
                  onPick(a.key)
                }}
              >
                {a.label}
              </PopupList.Button>
            ))}
            <PopupList.Divider />
            <PopupList.Button
              onClick={() => {
                close()
                openActionDrawer(row.id)
              }}
            >
              View log
            </PopupList.Button>
          </PopupList.ButtonGroup>
        )}
        size="fit-content"
        verticalAlign="bottom"
      />
      {modals}
    </>
  )
}

export const RowActionsCell: React.FC<DefaultCellComponentProps<any, any> & { rowData: Row }> = ({ collectionSlug, rowData }) => (
  <RowActions collectionSlug={collectionSlug} layout="menu" row={rowData} />
)

/** Footer actions in the edit view (the `actions` ui field). */
export const DocumentActionsField: React.FC = () => {
  const { collectionSlug, id, savedDocumentData } = useDocumentInfo()
  if (!id || !collectionSlug || !savedDocumentData) {
    return null
  }
  return <RowActions collectionSlug={collectionSlug} layout="buttons" row={{ ...(savedDocumentData as Row), id }} />
}
