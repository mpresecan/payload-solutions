'use client'

import { useActiveOrganization } from '@better-auth-ui/react/plugins/organization'
import { ChevronsUpDownIcon } from 'lucide-react'

import { OrganizationLogo } from '@/components/auth/organization/organization-logo'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '@/lib/auth/auth-client'

/** Sidebar-sized trigger for Better Auth UI's <OrganizationSwitcher>. */
export function OrgSwitcherTrigger() {
  const { data: organization, isPending } = useActiveOrganization(authClient)

  return (
    <DropdownMenuTrigger asChild>
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        {isPending ? (
          <Skeleton className="size-8 rounded-lg" />
        ) : (
          <OrganizationLogo organization={organization ?? null} className="size-8 rounded-lg" />
        )}
        <span className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{isPending ? 'Loading' : organization?.name ?? 'Select organization'}</span>
          <span className="truncate text-xs text-muted-foreground">{organization?.slug ?? 'Switch or create'}</span>
        </span>
        <ChevronsUpDownIcon className="ml-auto size-4" />
      </SidebarMenuButton>
    </DropdownMenuTrigger>
  )
}
