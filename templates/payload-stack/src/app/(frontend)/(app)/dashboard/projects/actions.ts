'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'
import { tenantData, tenantScope } from '@/lib/tenancy'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Give the project a name').max(80),
  description: z.string().trim().max(500).optional(),
})

export type ActionState = { ok: boolean; error?: string }

/**
 * Server actions for the example Projects collection. They run through Payload's local API with
 * the current user, so collection access control (including tenant scoping) applies.
 */
export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession(paths.dashboard.projects)
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const payload = await getPayloadClient()
  const scope = await tenantData()
  if (!scope.owner) return { ok: false, error: 'Not signed in' }

  await payload.create({
    collection: 'projects',
    data: { ...parsed.data, status: 'active', ...scope } as never,
    overrideAccess: true,
  })
  revalidatePath(paths.dashboard.projects)
  revalidatePath(paths.dashboard.home)
  return { ok: true }
}

export async function deleteProject(id: string | number): Promise<ActionState> {
  await requireSession(paths.dashboard.projects)
  const payload = await getPayloadClient()
  // Only delete within the caller's tenant, whatever id they sent.
  await payload.delete({
    collection: 'projects',
    where: { and: [{ id: { equals: id } }, await tenantScope()] },
    overrideAccess: true,
  })
  revalidatePath(paths.dashboard.projects)
  revalidatePath(paths.dashboard.home)
  return { ok: true }
}
