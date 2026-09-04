'use client'

import Link from 'next/link'
import * as React from 'react'

import { OrganizationSwitcher } from '@/components/auth/organization/organization-switcher'
import { NavMain } from '@/components/dashboard/nav-main'
import { NavSecondary } from '@/components/dashboard/nav-secondary'
import { NavUser } from '@/components/dashboard/nav-user'
import { OrgSwitcherTrigger } from '@/components/dashboard/org-switcher-trigger'
import { mainNav, secondaryNav } from '@/components/dashboard/nav-config'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { paths } from '@/lib/paths'
import stack from '@/stack.config'

/**
 * The dashboard sidebar (shadcn `sidebar-08`, inset variant). The header is the organization
 * switcher when organizations are enabled, otherwise the product name.
 */
export function AppSidebar({ isAdmin, ...props }: React.ComponentProps<typeof Sidebar> & { isAdmin: boolean }) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {stack.features.organizations ? (
              <OrganizationSwitcher align="start" side="bottom" hidePersonal trigger={<OrgSwitcherTrigger />} />
            ) : (
              <SidebarMenuButton size="lg" asChild>
                <Link href={paths.dashboard.home}>
                  <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
                    {stack.name.charAt(0)}
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{stack.name}</span>
                    <span className="truncate text-xs text-muted-foreground">Dashboard</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav()} />
        <NavSecondary items={secondaryNav(isAdmin)} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser isAdmin={isAdmin} />
      </SidebarFooter>
    </Sidebar>
  )
}
