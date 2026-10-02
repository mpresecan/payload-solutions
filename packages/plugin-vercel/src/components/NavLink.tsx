'use client'
import { Link, NavGroup, useConfig } from '@payloadcms/ui'
import React from 'react'

import { DEFAULT_VIEW_PATH, PLUGIN_SLUG } from '../constants.js'

/**
 * "Deployments" link after the collection groups in the admin nav (`admin.components.afterNavLinks`), in a
 * group named after `admin.group`. The deployments collection stays out of the nav while this link exists
 * (the view links to it as "Full log"), so the sidebar shows one group, not two of the same name.
 */
export const NavLink: React.FC = () => {
  const { config } = useConfig()
  const custom = (config.custom as Record<string, { navGroup?: string; viewPath?: null | string }> | undefined)?.[PLUGIN_SLUG]
  const viewPath = custom?.viewPath ?? DEFAULT_VIEW_PATH
  const href = `${config.routes.admin}${viewPath}`
  return (
    <NavGroup label={custom?.navGroup ?? 'Vercel'}>
      <Link className="nav__link" href={href} id="nav-plugin-vercel-deployments" prefetch={false}>
        <span className="nav__link-label">Deployments</span>
      </Link>
    </NavGroup>
  )
}
