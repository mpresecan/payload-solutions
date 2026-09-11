'use client'
import { Pill, useConfig, useDocumentInfo, useModal } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import type { DocumentState } from './api.js'

import { vercelApi } from './api.js'
import { DEPLOY_DRAWER_SLUG } from './DeployDrawer.js'

const LABELS: Record<DocumentState, string> = {
  deploying: 'Deploying…',
  failed: 'Deploy failed',
  live: 'Live',
  pending: 'Not deployed yet',
}

const STYLES: Record<DocumentState, 'error' | 'light' | 'success' | 'warning'> = {
  deploying: 'light',
  failed: 'error',
  live: 'success',
  pending: 'warning',
}

/**
 * `beforeDocumentControls` on tracked collections and globals: is this document live on the site?
 * Clicking a pending pill opens the Deploy drawer (rendered by the header widget on the same page).
 */
export const DocumentPill: React.FC = () => {
  const { config } = useConfig()
  const { collectionSlug, globalSlug, id } = useDocumentInfo()
  const { openModal } = useModal()
  const [states, setStates] = useState<null | Record<string, DocumentState>>(null)
  const apiRoute = config.routes.api
  const key = `${collectionSlug ?? ''}|${globalSlug ?? ''}|${id ?? ''}`

  useEffect(() => {
    if (!globalSlug && (!collectionSlug || id === undefined || id === null)) {
      return
    }
    let cancelled = false
    let timer: null | ReturnType<typeof setTimeout> = null
    const load = async () => {
      try {
        const res = await vercelApi.document(apiRoute, { collection: collectionSlug, global: globalSlug, id: id ?? undefined })
        if (cancelled) {
          return
        }
        setStates(res.tracked ? res.targets : {})
        const settled = Object.values(res.targets).every((s) => s === 'live')
        timer = setTimeout(load, settled ? 60_000 : 10_000)
      } catch {
        if (!cancelled) {
          setStates({})
        }
      }
    }
    void load()
    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRoute, key])

  if (!states || Object.keys(states).length === 0) {
    return null
  }
  const entries = Object.entries(states)
  return (
    <div className="plugin-vercel-document-pill" style={{ alignItems: 'center', display: 'inline-flex', flexWrap: 'wrap', gap: 'calc(var(--base) / 4)' }}>
      {entries.map(([target, state]) => (
        <Pill
          key={target}
          onClick={state === 'pending' || state === 'failed' ? () => openModal(DEPLOY_DRAWER_SLUG) : undefined}
          pillStyle={STYLES[state]}
          size="small"
        >
          {entries.length > 1 ? `${target}: ` : ''}
          {LABELS[state]}
          {state === 'pending' || state === 'failed' ? ' · Deploy' : ''}
        </Pill>
      ))}
    </div>
  )
}
