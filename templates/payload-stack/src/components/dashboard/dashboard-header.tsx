'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { paths } from '@/lib/paths'

const LABELS: Record<string, string> = {
  dashboard: 'Overview',
  projects: 'Projects',
  settings: 'Settings',
  account: 'Account',
  security: 'Security',
  organizations: 'Organizations',
  billing: 'Billing',
  organization: 'Organization',
  people: 'People',
  teams: 'Teams',
  roles: 'Roles',
  admin: 'Admin',
  users: 'Users',
}

function label(segment: string) {
  return LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export function DashboardHeader() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((segment, i) => ({
    segment,
    href: '/' + segments.slice(0, i + 1).join('/'),
    last: i === segments.length - 1,
  }))

  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, i) => (
              <Fragment key={crumb.href}>
                {i > 0 ? <BreadcrumbSeparator className="hidden md:block" /> : null}
                <BreadcrumbItem className={i < crumbs.length - 1 ? 'hidden md:block' : undefined}>
                  {crumb.last ? (
                    <BreadcrumbPage>{label(crumb.segment)}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.segment === 'dashboard' ? paths.dashboard.home : crumb.href}>{label(crumb.segment)}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
