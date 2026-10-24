---
name: stack-dashboard-page
description: Use when adding a page, form or server action to the signed-in dashboard of this Payload Stack project (src/app/(frontend)/(app)/dashboard), or a link in its sidebar.
---

# Add a dashboard page

The Projects page (`src/app/(frontend)/(app)/dashboard/projects/`) is the reference: a server
component that lists, a client form that calls a server action, a loading skeleton.

## Files

```
src/app/(frontend)/(app)/dashboard/<feature>/
├── page.tsx         # server component: session, data, layout
├── actions.ts       # 'use server' mutations, zod-validated
├── <feature>-form.tsx  # 'use client' form using useActionState
└── loading.tsx      # Skeleton shown while page.tsx resolves
```

The dashboard layout (`dashboard/layout.tsx`) already redirects signed-out visitors and sends users
without an organization to onboarding. Pages still call `requireSession(paths.dashboard.<x>)` so a
direct request returns to the right place after sign-in.

## Steps

1. **Route.** Add the URL to `src/lib/paths.ts` under `dashboard`. Every link, redirect and email
   reads from there; never hard-code `/dashboard/...` in a component.
2. **Page.** In `page.tsx`:
   - `export const metadata: Metadata = { title: '<Feature>' }`
   - `await requireSession(paths.dashboard.<feature>)`
   - read with `getPayloadClient()` and `tenantScope()` (see the `stack-collection` skill for the
     scoping rules).
   - Heading block: `<h1 className="text-2xl font-semibold tracking-tight">` and a
     `text-muted-foreground` line under it, as on Projects.
3. **Action.** In `actions.ts`, start with `'use server'`, then:
   - `await requireSession(...)` first. A server action is a public endpoint; the page's check does
     not protect it.
   - Validate `FormData` with a zod schema and return `{ ok: false, error }` with the first issue.
   - Write with `tenantData()` (create) or a `where` that includes `tenantScope()` (update/delete).
   - `revalidatePath(paths.dashboard.<feature>)`, plus `paths.dashboard.home` if the overview shows
     the data.
   - Return the `ActionState` shape `{ ok: boolean; error?: string }`.
4. **Form.** `'use client'`, `useActionState(action, { ok: false })`, a `toast.success` from
   `sonner` in an effect on `state.ok`, `Spinner` in the submit button while `pending`.
5. **UI.** Use the shadcn components in `src/components/ui/*` (Card, Table, Empty, Badge,
   Skeleton, ...). Add a missing one with `pnpm dlx shadcn@latest add <name>`. Do not edit
   `src/components/auth/*`: it is vendored from Better Auth UI.
6. **Sidebar.** Add an item to `mainNav()` in `src/components/dashboard/nav-config.tsx` with a
   `lucide-react` icon. Gate it on `stack.features.*` when the page only exists for some products,
   the way Organization and Billing are.
7. **Plans.** `billing.plans[].limits` in `src/stack.config.ts` is declared for your code to read;
   the template does not enforce it anywhere yet. If the feature is paid, write the check
   explicitly in the page and in the action (the action is what must refuse), cover it with a unit
   test, and tell the user in the page what their plan allows rather than hiding the feature.

## Tests

- `tests/unit/nav-and-routes.spec.tsx`: the nav item appears under the presets that should have it
  and not under the others (`loadWithStack(presets[...])`).
- `tests/unit/actions.spec.ts`: copy the `loadProjectActions` pattern to check validation, that
  writes carry the tenant scope, and which paths are revalidated.
- `tests/e2e/dashboard.e2e.spec.ts`: one journey through the page with the `member` fixture.

Finish with `pnpm verify`, then open the page in the browser (Playwright or Next.js DevTools MCP)
with the dev server running.
