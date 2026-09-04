'use server'

import { requireSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'
import { toPayloadId } from '@/lib/ids'

/** Marks the current user as onboarded. Called after the first organization exists. */
export async function completeOnboarding() {
  const session = await requireSession(paths.onboarding)
  const payload = await getPayloadClient()
  await payload.update({
    collection: 'users',
    id: toPayloadId(payload, session.user.id),
    data: { onboardedAt: new Date().toISOString() } as never,
    overrideAccess: true,
  })
  return { ok: true as const }
}
