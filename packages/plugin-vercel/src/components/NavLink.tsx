'use client'
import { Link, NavGroup, useConfig } from '@payloadcms/ui'
import React from 'react'

import { DEFAULT_VIEW_PATH, PLUGIN_SLUG } from '../constants.js'

/** "Deployments" link after the collection groups in the admin nav (`admin.components.afterNavLinks`). */
export const NavLink: React.FC = () => {
  const { config } = useConfig()
  const custom = (config.custom as Record<string, { viewPath?: null | string }> | undefined)?.[PLUGIN_SLUG]
  const viewPath = custom?.viewPath ?? DEFAULT_VIEW_PATH
  const href = `${config.routes.admin}${viewPath}`
  return (
    <NavGroup label="Vercel">
      <Link className="nav__link" href={href} id="nav-plugin-vercel-deployments" prefetch={false}>
        <span className="nav__link-label">Deployments</span>
      </Link>
    </NavGroup>
  )
}
