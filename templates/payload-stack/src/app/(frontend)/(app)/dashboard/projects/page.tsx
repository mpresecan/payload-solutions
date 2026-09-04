import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'
import { tenantScope } from '@/lib/tenancy'
import { DeleteProjectButton } from './delete-button'
import { ProjectForm } from './project-form'

export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  await requireSession(paths.dashboard.projects)
  const payload = await getPayloadClient()
  const projects = await payload.find({
    collection: 'projects',
    where: await tenantScope(),
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">An example collection scoped to the active organization.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border">
          {projects.docs.length === 0 ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>Create the first one with the form.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.docs.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="font-medium">{project.name}</div>
                      {project.description ? (
                        <div className="line-clamp-1 text-sm text-muted-foreground">{project.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>{project.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </TableCell>
                    <TableCell>
                      <DeleteProjectButton id={project.id} name={project.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <ProjectForm />
      </div>
    </>
  )
}
