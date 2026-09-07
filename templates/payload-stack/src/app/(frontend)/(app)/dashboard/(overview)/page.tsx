import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'
import { getActiveOrganization, tenantScope } from '@/lib/tenancy'
import stack from '@/stack.config'

export default async function DashboardPage() {
  const session = await requireSession(paths.dashboard.home)
  const payload = await getPayloadClient()
  const [organization, projects] = await Promise.all([
    getActiveOrganization(),
    payload.count({ collection: 'projects', where: await tenantScope(), overrideAccess: true }),
  ])

  const firstName = session.user.name?.split(' ')[0] || session.user.email

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground">
          {organization ? `You are working in ${organization.name}.` : `Here is what is happening in ${stack.name}.`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Projects</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{projects.totalDocs}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={paths.dashboard.projects}>
                Manage projects
                <ArrowRightIcon />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {stack.features.organizations ? (
          <Card>
            <CardHeader>
              <CardDescription>Organization</CardDescription>
              <CardTitle className="truncate text-xl">{organization?.name ?? 'None selected'}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={paths.dashboard.organizationPeople}>
                  Invite people
                  <ArrowRightIcon />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {stack.features.billing ? (
          <Card>
            <CardHeader>
              <CardDescription>Billing</CardDescription>
              <CardTitle className="text-xl">Plans and invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={stack.features.billingAttachedTo === 'organization' ? paths.dashboard.organizationBilling : paths.dashboard.billing}>
                  Manage billing
                  <ArrowRightIcon />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardDescription>Account</CardDescription>
              <CardTitle className="text-xl">Security and sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={paths.dashboard.security}>
                  Review security
                  <ArrowRightIcon />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>This is your product&apos;s home</CardTitle>
          <CardDescription>
            Replace this page with what your users came for. The pieces around it (auth, organizations, billing,
            settings, admin) are done. Start in <code className="rounded bg-muted px-1 py-0.5 text-xs">src/app/(frontend)/(app)/dashboard</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  )
}
