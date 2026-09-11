import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Banner, Gutter, SetStepNav } from '@payloadcms/ui'
import React from 'react'

import type { DeploymentRecord, PendingChange, TargetStatus } from '../types.js'

import { DeploymentsClient } from './DeploymentsClient.js'

export type DeploymentsViewData = {
  autoDeploy: false | { maxWaitMs: number; quietPeriodMs: number }
  history: Record<string, DeploymentRecord[]>
  /** Server clock at render time; the client formats countdowns from it until hydrated, so both sides agree. */
  now: string
  pending: Record<string, PendingChange[]>
  permissions: { deploy: boolean; rollback: boolean }
  setup: {
    apiBase: string
    heartbeat: boolean
    tickJob: false | { cron: string; queue: string }
    webhook: boolean
  }
  targets: TargetStatus[]
}

/**
 * `/admin/deployments` — a root custom view. Payload does not wrap custom root views in a template, so this
 * renders `DefaultTemplate` itself (nav, header, step nav) and hands the data to a client component.
 */
export const DeploymentsView = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const api = payload.vercel

  const shell = (children: React.ReactNode) => (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={user ?? undefined}
      viewType="dashboard"
      visibleEntities={visibleEntities}
    >
      <SetStepNav nav={[{ label: 'Deployments' }]} />
      <Gutter>{children}</Gutter>
    </DefaultTemplate>
  )

  if (!user) {
    return shell(<Banner type="error">Log in to see deployments.</Banner>)
  }
  if (!api) {
    return shell(<Banner type="error">The Vercel plugin has not initialised.</Banner>)
  }
  const allowed = await api.options.access.read({ req })
  if (!allowed) {
    return shell(<Banner type="error">You do not have access to deployments.</Banner>)
  }

  const [canDeploy, canRollback, targets] = await Promise.all([api.options.access.deploy({ req }), api.options.access.rollback({ req }), api.status()])
  const pending: Record<string, PendingChange[]> = {}
  const history: Record<string, DeploymentRecord[]> = {}
  for (const target of targets) {
    pending[target.slug] = await api.pending(target.slug, { limit: 50 })
    history[target.slug] = await api.history(target.slug, { limit: 20 })
  }

  const data: DeploymentsViewData = {
    autoDeploy: api.options.autoDeploy,
    history,
    now: new Date().toISOString(),
    pending,
    permissions: { deploy: Boolean(canDeploy), rollback: Boolean(canRollback) },
    setup: {
      apiBase: api.options.apiBase,
      heartbeat: api.options.tick.adminHeartbeat,
      tickJob: api.options.tick.job,
      webhook: Boolean(api.options.webhookSecret),
    },
    targets,
  }

  return shell(<DeploymentsClient initial={data} />)
}
