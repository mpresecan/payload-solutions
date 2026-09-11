'use client'

import { PopupList, toast, useConfig, useSelection } from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import React, { useState } from 'react'

import { apiBase, call } from './api.js'
import { requestRefresh } from './shared.js'

/** Items for the list view's "…" menu (`listMenuItems`), applied to the selected rows. */
export const BulkActions: React.FC<{ collectionSlug?: string }> = ({ collectionSlug = 'scheduled-actions' }) => {
  const { config } = useConfig()
  const { count, selectedIDs } = useSelection()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const base = apiBase(config, collectionSlug)

  const apply = async (op: 'cancel' | 'delete' | 'retry' | 'run-now') => {
    if (!selectedIDs.length) {
      toast.info('Select some rows first')
      return
    }
    setBusy(true)
    try {
      const { body, ok } = await call<{ applied: number; message?: string; selected: number }>(`${base}/scheduler/bulk`, { body: JSON.stringify({ ids: selectedIDs, op }), method: 'POST' })
      if (ok) {
        toast[body.applied === body.selected ? 'success' : 'warning'](body.message ?? `Applied to ${body.applied}`)
      } else {
        toast.error(body.message ?? 'Failed')
      }
      requestRefresh()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }
  const suffix = count ? ` (${count})` : ''
  return (
    <React.Fragment>
      <PopupList.Button disabled={busy || !count} onClick={() => void apply('run-now')}>
        Run now{suffix}
      </PopupList.Button>
      <PopupList.Button disabled={busy || !count} onClick={() => void apply('retry')}>
        Retry{suffix}
      </PopupList.Button>
      <PopupList.Button disabled={busy || !count} onClick={() => void apply('cancel')}>
        Cancel{suffix}
      </PopupList.Button>
      <PopupList.Button disabled={busy || !count} onClick={() => void apply('delete')}>
        Delete finished{suffix}
      </PopupList.Button>
    </React.Fragment>
  )
}
