'use client'
import { Button, Pill, Popup, PopupList, toast, Tooltip, useConfig, useModal } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

import type { TargetStatus } from '../types.js'

import { ApiError, invalidateStatus, vercelApi } from './api.js'
import { DEPLOY_DRAWER_SLUG, DeployDrawer } from './DeployDrawer.js'
import { present } from './status.js'
import { useVercelStatus } from './useVercelStatus.js'

/**
 * Rendered top-right on every admin page (`admin.components.actions`): one status pill per target and a
 * Deploy button. The status poll behind it is the heartbeat tick for automatic deployments.
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

  const renderTarget = (t: TargetStatus, withLabel: boolean) => {
    const p = present(t, now, autoDeploy)
    const label = withLabel ? `${t.label}: ${p.text}` : p.text
    return (
      <span
        key={t.slug}
        onMouseEnter={() => setHover(t.slug)}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'inline-flex', position: 'relative' }}
      >
        <Pill pillStyle={p.pillStyle} size="small" to={viewHref}>
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
      {data.targets.length <= 2 ? (
        data.targets.map((t) => renderTarget(t, data.targets.length > 1))
      ) : (
        <Popup
          button={renderTarget(data.targets[0]!, true)}
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
