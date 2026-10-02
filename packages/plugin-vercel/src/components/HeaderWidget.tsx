'use client'
import { Button, Pill, Popup, PopupList, toast, Tooltip, useConfig, useModal } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

import type { TargetStatus } from '../types.js'
import type { Presentation } from './status.js'

import { ApiError, invalidateStatus, vercelApi } from './api.js'
import { DEPLOY_DRAWER_SLUG, DeployDrawer } from './DeployDrawer.js'
import { present } from './status.js'
import { useVercelStatus } from './useVercelStatus.js'

/** Which target the collapsed header pill speaks for when there are several: the one needing attention. */
const URGENCY: Presentation['tone'][] = ['error', 'building', 'waiting', 'paused', 'pending', 'unconfigured', 'ok', 'idle']
function mostUrgent(targets: TargetStatus[], now: number, autoDeploy: boolean): TargetStatus {
  const rank = (t: TargetStatus) => URGENCY.indexOf(present(t, now, autoDeploy).tone)
  return targets.reduce((a, b) => (rank(b) < rank(a) ? b : a))
}

/**
 * Rendered top-right on every admin page (`admin.components.actions`): a status pill and a Deploy button.
 * With several targets the pill speaks for the one needing attention and opens a menu listing all of them —
 * Payload caps the header's action area at 600px, so one pill per target overflows into the account icon.
 * The status poll behind it is the heartbeat tick for automatic deployments.
 */
export const HeaderWidget: React.FC = () => {
  const { config } = useConfig()
  const { apiRoute, data, error, now, refresh } = useVercelStatus()
  const { openModal } = useModal()
  const [hover, setHover] = useState<null | string>(null)

  const resume = useCallback(
    async (slug: string) => {
      try {
        await vercelApi.pause(apiRoute, slug, false)
        invalidateStatus()
        await refresh({ tick: false })
        toast.success('Automatic deployments resumed')
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not resume')
      }
    },
    [apiRoute, refresh],
  )

  if (error && !data) {
    return null
  }
  if (!data) {
    return (
      <Pill pillStyle="light-gray" size="small">
        Vercel…
      </Pill>
    )
  }

  const autoDeploy = Boolean(data.autoDeploy)
  const viewHref = data.viewPath ? `${config.routes.admin}${data.viewPath}` : undefined
  const canDeploy = data.permissions.deploy
  const configured = data.targets.filter((t) => t.configured)
  const inFlight = data.targets.some((t) => t.inFlight)

  const renderTarget = (t: TargetStatus, withLabel: boolean, suffix = '', linked = true) => {
    const p = present(t, now, autoDeploy)
    const label = `${withLabel ? `${t.label}: ${p.text}` : p.text}${suffix}`
    return (
      <span
        key={t.slug}
        onMouseEnter={() => setHover(t.slug)}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'inline-flex', position: 'relative' }}
      >
        <Pill pillStyle={p.pillStyle} size="small" to={linked ? viewHref : undefined}>
          {label}
        </Pill>
        {p.detail && (
          <Tooltip position="bottom" show={hover === t.slug}>
            {p.detail}
          </Tooltip>
        )}
      </span>
    )
  }

  const paused = configured.find((t) => t.paused)

  return (
    <div className="plugin-vercel-header" style={{ alignItems: 'center', display: 'inline-flex', gap: 'calc(var(--base) / 4)' }}>
      {data.targets.length === 1 ? (
        renderTarget(data.targets[0]!, false)
      ) : (
        <Popup
          button={renderTarget(mostUrgent(data.targets, now, autoDeploy), true, ` · +${data.targets.length - 1}`, false)}
          buttonType="custom"
          horizontalAlign="right"
          render={() => <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>{data.targets.map((t) => renderTarget(t, true))}</div>}
          size="medium"
        />
      )}
      {canDeploy && configured.length > 0 && (
        <Button
          buttonStyle="secondary"
          onClick={() => openModal(DEPLOY_DRAWER_SLUG)}
          size="small"
          SubMenuPopupContent={
            paused
              ? ({ close }) => (
                  <PopupList.ButtonGroup>
                    <PopupList.Button
                      onClick={() => {
                        close()
                        void resume(paused.slug)
                      }}
                    >
                      Resume automatic deployments ({paused.label})
                    </PopupList.Button>
                  </PopupList.ButtonGroup>
                )
              : undefined
          }
        >
          {inFlight ? 'Deploy again' : 'Deploy'}
        </Button>
      )}
      <DeployDrawer apiRoute={apiRoute} autoDeploy={autoDeploy} now={now} onDeployed={() => void refresh({ tick: false })} targets={data.targets} />
    </div>
  )
}
