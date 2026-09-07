/**
 * Who may manage a subscription.
 *
 * @better-auth/stripe calls `authorizeReference` before every checkout, upgrade, cancel or portal
 * request with the `referenceId` the client sent. Users may always manage their own subscription
 * (referenceId === user.id). With billing attached to organizations the reference is an
 * organization id, and only its owners and admins may act on it.
 *
 * Payload is resolved lazily to avoid an import cycle with payload.config.ts.
 */
export const SUBSCRIPTION_MANAGER_ROLES = ['owner', 'admin'] as const

export async function authorizeSubscriptionReference({
  user,
  referenceId,
}: {
  user: { id: string }
  referenceId: string
}): Promise<boolean> {
  if (referenceId === user.id) return true

  const { getPayloadClient } = await import('@/lib/payload')
  const { toPayloadId } = await import('@/lib/ids')
  const payload = await getPayloadClient()
  const members = await payload.find({
    collection: 'members',
    where: {
      and: [
        { user: { equals: toPayloadId(payload, user.id) } },
        { organization: { equals: toPayloadId(payload, referenceId) } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const role = members.docs[0]?.role
  return typeof role === 'string' && (SUBSCRIPTION_MANAGER_ROLES as readonly string[]).includes(role)
}
