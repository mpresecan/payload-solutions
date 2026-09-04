import type { Access, FieldAccess, TypedUser } from 'payload'

type UserWithRole = TypedUser & { role?: string[] | null }

/** Site administrators: the `admin` role managed by Better Auth's admin plugin. */
export function isAdmin(user: TypedUser | null | undefined): boolean {
  const roles = (user as UserWithRole | null | undefined)?.role
  return Array.isArray(roles) && roles.includes('admin')
}

export const adminOnly: Access = ({ req }) => isAdmin(req.user)

export const adminOnlyField: FieldAccess = ({ req }) => isAdmin(req.user)

export const anyone: Access = () => true

export const authenticated: Access = ({ req }) => Boolean(req.user)

/** Admins see everything; everyone else only documents they own. */
export const adminOrOwner =
  (ownerField = 'owner'): Access =>
  ({ req }) => {
    if (!req.user) return false
    if (isAdmin(req.user)) return true
    return { [ownerField]: { equals: req.user.id } }
  }
