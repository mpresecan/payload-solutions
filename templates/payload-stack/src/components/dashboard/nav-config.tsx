import {
  BookOpenIcon,
  BuildingIcon,
  CreditCardIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  Settings2Icon,
  ShieldIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { paths } from '@/lib/paths'
import stack from '@/stack.config'

export type NavItem = {
  title: string
  url: string
  icon?: ReactNode
  isActive?: boolean
  items?: { title: string; url: string }[]
}

/** Main dashboard navigation, derived from the features enabled in stack.config.ts. */
export function mainNav(): NavItem[] {
  const items: NavItem[] = [
    { title: 'Overview', url: paths.dashboard.home, icon: <LayoutDashboardIcon /> },
    { title: 'Projects', url: paths.dashboard.projects, icon: <FolderKanbanIcon /> },
  ]

  if (stack.features.organizations) {
    const orgItems: { title: string; url: string }[] = [
      { title: 'General', url: paths.dashboard.organizationSettings },
      { title: 'People', url: paths.dashboard.organizationPeople },
    ]
    if (stack.features.billingAttachedTo === 'organization') {
      orgItems.push({ title: 'Billing', url: paths.dashboard.organizationBilling })
    }
    items.push({ title: 'Organization', url: paths.dashboard.organizationSettings, icon: <BuildingIcon />, items: orgItems })
  }

  const settingsItems: { title: string; url: string }[] = [
    { title: 'Account', url: paths.dashboard.account },
    { title: 'Security', url: paths.dashboard.security },
  ]
  if (stack.features.organizations) settingsItems.push({ title: 'Organizations', url: paths.dashboard.organizations })
  if (stack.features.billingAttachedTo === 'user') settingsItems.push({ title: 'Billing', url: paths.dashboard.billing })
  items.push({ title: 'Settings', url: paths.dashboard.account, icon: <Settings2Icon />, items: settingsItems })

  return items
}

export function secondaryNav(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { title: 'Documentation', url: 'https://payload.solutions/docs/payload-stack', icon: <BookOpenIcon /> },
    { title: 'Support', url: `mailto:${stack.support.email}`, icon: <LifeBuoyIcon /> },
  ]
  if (isAdmin) {
    items.unshift({ title: 'Payload admin', url: paths.payloadAdmin, icon: <ShieldIcon /> })
  }
  return items
}

export const billingIcon = <CreditCardIcon />
