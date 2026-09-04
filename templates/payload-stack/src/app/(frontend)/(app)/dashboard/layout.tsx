import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { ActiveOrganizationSync } from '@/components/dashboard/active-organization-sync'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getSession, isSiteAdmin } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import { listUserOrganizations } from '@/lib/tenancy'
import stack from '@/stack.config'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect(paths.auth.signIn)

  // First visit with organizations enabled: create one before entering the dashboard.
  if (stack.features.organizations) {
    const organizations = await listUserOrganizations()
    if (organizations.length === 0) redirect(paths.onboarding)
  }

  return (
    <SidebarProvider>
      {stack.features.organizations ? <ActiveOrganizationSync /> : null}
      <AppSidebar isAdmin={isSiteAdmin(session)} />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0 md:p-6 md:pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
