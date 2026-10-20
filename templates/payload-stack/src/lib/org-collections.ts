import type { CollectionSlug } from 'payload'

/**
 * The organization collections exist only when `stack.features.organizations` is on.
 *
 * Payload regenerates `payload-types.ts` from the live config (on `pnpm dev`, or with
 * `pnpm generate:types`), so in a project with organizations turned off these slugs and their
 * documents drop out of the generated types, and every literal `'members'` or `'organizations'`
 * stops compiling, which fails `pnpm build`. Code that only runs with organizations on names the
 * collections through here instead, so the project type-checks with the flag either way.
 *
 * The document types are declared by hand for the same reason: importing `Organization` or
 * `Member` from `@/payload-types` breaks as soon as the types are regenerated without them. Keep
 * them to the fields the application reads.
 */
export const ORGANIZATIONS = 'organizations' as unknown as CollectionSlug
export const MEMBERS = 'members' as unknown as CollectionSlug
export const INVITATIONS = 'invitations' as unknown as CollectionSlug

type Ref<T> = string | number | T

export type OrganizationDoc = {
  id: string | number
  name: string
  slug: string
  logo?: string | null
  onboardedAt?: string | null
  metadata?: string | null
  createdAt: string
  updatedAt: string
}

export type MemberDoc = {
  id: string | number
  organization: Ref<OrganizationDoc>
  user: Ref<{ id: string | number }>
  role: string
  createdAt: string
  updatedAt: string
}
