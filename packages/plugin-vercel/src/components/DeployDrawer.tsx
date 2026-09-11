'use client'
import { Banner, Button, CheckboxInput, Drawer, Pill, TextInput, toast, useModal } from '@payloadcms/ui'
import React, { type ChangeEvent, useCallback, useEffect, useState } from 'react'

import type { PendingChange, TargetStatus } from '../types.js'

import { ApiError, invalidateStatus, vercelApi } from './api.js'
import { present } from './status.js'

export const DEPLOY_DRAWER_SLUG = 'plugin-vercel-deploy'

type Props = {
  apiRoute: string
  autoDeploy: boolean
  now: number
  onDeployed?: () => void
  /** Modal slug; the view uses its own so two drawers never open together. */
  slug?: string
  targets: TargetStatus[]
}

/**
 * The Deploy dialog: a Payload `Drawer` with target choice, optional reason, the build-cache switch and the
 * first pending changes of the chosen target. Opened by the header widget, the document pill and the view.
 */
export const DeployDrawer: React.FC<Props> = ({ apiRoute, autoDeploy, now, onDeployed, slug = DEPLOY_DRAWER_SLUG, targets }) => {
  const { closeModal, isModalOpen } = useModal()
  const open = isModalOpen(slug)
  const configured = targets.filter((t) => t.configured)
  const [targetSlug, setTargetSlug] = useState<null | string>(null)
  const [reason, setReason] = useState('')
  const [skipCache, setSkipCache] = useState(false)
  const [busy, setBusy] = useState(false)
  const [changes, setChanges] = useState<PendingChange[]>([])
  // The chosen target, falling back to the first configured one until the editor picks.
  const target = configured.find((t) => t.slug === targetSlug) ?? configured[0]

  useEffect(() => {
    if (!open || !target) {
      return
    }
    let cancelled = false
    vercelApi
      .changes(apiRoute, target.slug, 10)
      .then((res) => {
        if (!cancelled) {
          setChanges(res.changes)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChanges([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiRoute, open, target])

  const deploy = useCallback(async () => {
    if (!target) {
      return
    }
    setBusy(true)
    try {
      await vercelApi.deploy(apiRoute, { buildCache: skipCache ? false : undefined, reason: reason.trim() || undefined, target: target.slug })
      toast.success(`Deployment of ${target.label} requested`)
      invalidateStatus()
      setReason('')
      setSkipCache(false)
      closeModal(slug)
      onDeployed?.()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not trigger the deployment'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }, [apiRoute, closeModal, onDeployed, reason, skipCache, slug, target])

  const presentation = target ? present(target, now, autoDeploy) : null

  return (
    <Drawer slug={slug} title="Deploy">
      {configured.length === 0 ? (
        <Banner type="error">No target has a deploy hook configured.</Banner>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--base)' }}>
          {configured.length > 1 && (
            <div>
              <div style={{ marginBottom: 'calc(var(--base) / 4)', fontWeight: 600 }}>Target</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'calc(var(--base) / 4)' }}>
                {configured.map((t) => (
                  <Pill key={t.slug} onClick={() => setTargetSlug(t.slug)} pillStyle={t.slug === target?.slug ? 'dark' : 'light'} size="small">
                    {t.label}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {presentation && (
            <div>
              <Pill pillStyle={presentation.pillStyle} size="small">
                {presentation.text}
              </Pill>
              {presentation.detail && <div style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', marginTop: '4px' }}>{presentation.detail}</div>}
              {target?.inFlight && (
                <div style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', marginTop: '4px' }}>
                  A deployment is already in flight. Deploying again makes Vercel cancel it and start over.
                </div>
              )}
            </div>
          )}

          {target && target.pendingCount > 0 && (
            <div>
              <div style={{ marginBottom: 'calc(var(--base) / 4)', fontWeight: 600 }}>
                {target.pendingCount} pending {target.pendingCount === 1 ? 'change' : 'changes'}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {changes.map((c) => (
                  <li key={c.id} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--theme-elevation-100)' }}>
                    <span style={{ flex: 1 }}>{c.title}</span>
                    <span style={{ color: 'var(--theme-elevation-500)', fontSize: '12px' }}>
                      {c.global ? c.global : c.collection} · {c.operation}
                      {c.saves > 1 ? ` ×${c.saves}` : ''}
                    </span>
                  </li>
                ))}
                {target.pendingCount > changes.length && (
                  <li style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', padding: '4px 0' }}>…and {target.pendingCount - changes.length} more</li>
                )}
              </ul>
            </div>
          )}

          <TextInput label="Reason (optional)" onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)} path="plugin-vercel-reason" placeholder="Why this deployment?" value={reason} />
          <CheckboxInput checked={skipCache} id="plugin-vercel-skip-cache" label="Skip the build cache" onToggle={() => setSkipCache((v) => !v)} />

          <div style={{ display: 'flex', gap: 'calc(var(--base) / 2)' }}>
            <Button buttonStyle="primary" disabled={busy || !target} onClick={() => void deploy()}>
              {busy ? 'Deploying…' : target?.inFlight ? 'Deploy again' : 'Deploy'}
            </Button>
            <Button buttonStyle="secondary" disabled={busy} onClick={() => closeModal(slug)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
