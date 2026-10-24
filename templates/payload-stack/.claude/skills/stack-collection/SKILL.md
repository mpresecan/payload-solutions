---
name: stack-collection
description: Use when adding or changing a Payload collection in this Payload Stack project, especially one whose documents belong to an organization or a user (tenant-scoped data). Covers registration, tenancy, access, cleanup, generated types and the tests that guard isolation.
---

# Add a tenant-scoped collection

Every record a customer creates belongs to someone. In Payload Stack that owner is the active
organization when `stack.features.organizations` is on, and the user when it is off. The example
to copy is `src/collections/Projects.ts`; this skill is the checklist around it.

## 1. Write the collection

Create `src/collections/<Name>.ts` modelled on `Projects.ts`:

- `access` branches on `stack.features.organizations`:
  - organizations on: `authenticated` for read/create/update/delete. The multi-tenant plugin adds
    the tenant constraint on top, so these are not as open as they look.
  - organizations off: `adminOrOwner()` for read/update/delete, `authenticated` for create.
- Keep the `owner` relationship to `users` with the `beforeChange` hook that fills it from
  `req.user` on create. Without organizations it is the only thing that scopes a document.
- Do not add a `tenant` field yourself. The multi-tenant plugin adds it (required) from the list
  in step 2.
- `admin.group: 'App'` keeps customer data together in the admin.
- Access helpers live in `src/access` (`isAdmin`, `adminOnly`, `anyone`, `authenticated`,
  `adminOrOwner`). Reuse them rather than writing inline checks.

## 2. Register it in exactly two places

1. `src/payload.config.ts` → `collections: [...]`.
2. `src/tenancy/cleanup.ts` → `TENANT_SCOPED_COLLECTIONS`.

That one array does two jobs: `payload.config.ts` builds the multi-tenant plugin's `collections`
from it, and `withTenantCleanup` deletes the collection's documents *before* an organization row
is deleted. On SQL databases the tenant foreign key is `ON DELETE SET NULL`, so a collection that
is registered with the plugin but missing here survives an organization delete as orphans with
`tenant: null`. Never pass a second, hand-written list to `multiTenantPlugin`.

A collection that is global rather than per-customer (a public catalogue, settings) skips step 2
and gets explicit access instead, usually `anyone` for read and `adminOnly` for writes.

## 3. Read and write it from the app

Frontend server code goes through the local API with `overrideAccess: true` and scopes itself.
This is safe only because every call carries the scope:

```ts
import { getPayloadClient } from '@/lib/payload'
import { tenantData, tenantScope } from '@/lib/tenancy'

const payload = await getPayloadClient()

// read: always the tenant scope, combined with your own filter through `and`
const { docs } = await payload.find({
  collection: 'invoices',
  where: { and: [{ status: { equals: 'open' } }, await tenantScope()] },
  depth: 0,
  overrideAccess: true,
})

// create: spread tenantData() so the document lands in the active tenant
await payload.create({ collection: 'invoices', data: { ...input, ...(await tenantData()) } as never, overrideAccess: true })

// update / delete: by where, never by bare id, so a forged id from another tenant matches nothing
await payload.delete({
  collection: 'invoices',
  where: { and: [{ id: { equals: id } }, await tenantScope()] },
  overrideAccess: true,
})
```

`overrideAccess: true` without `tenantScope()` in the `where` is a data leak. When you are not
writing frontend code (an endpoint, a hook acting for a user), prefer `overrideAccess: false` and
pass `user` so Payload's access control and the plugin's tenant constraint apply.

Inside a hook, pass `req` to every nested Payload call so it joins the same transaction.

Better Auth ids are strings; Payload ids may be numbers. Normalize with `toPayloadId` from
`src/lib/ids.ts` before comparing or querying.

Code that must compile with organizations off never writes the literal slugs `'organizations'`,
`'members'` or `'invitations'`: import `ORGANIZATIONS` / `MEMBERS` / `INVITATIONS` and the hand-written
doc types from `src/lib/org-collections.ts`. Those collections drop out of `payload-types.ts` when
the flag is off.

## 4. Regenerate

```bash
pnpm generate:types       # payload-types.ts
pnpm generate:importmap   # only if you added admin components
```

A schema change on PostgreSQL or SQLite that should reach production also needs a migration:
`pnpm db:migrate:create <name>`.

## 5. Test it

- `tests/unit/payload-config.spec.ts`: assert the collection is registered, and (with organizations
  on) that it carries the plugin's `tenant` field. The `projects`/`media` cases show both.
- `tests/unit/tenancy.spec.ts`: the cleanup test reads `TENANT_SCOPED_COLLECTIONS`; check it covers
  the new slug.
- `tests/int/tenancy-access.int.spec.ts`: add a case where a member of organization A cannot read,
  update or delete organization B's document through the local API with `overrideAccess: false`.
  This is the test that proves isolation; do not skip it.

See the `stack-tests` skill for helpers. Finish with `pnpm verify`.
