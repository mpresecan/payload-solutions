---
name: stack-tests
description: Use when writing, extending or fixing tests in this Payload Stack project (Vitest unit and integration, Playwright end-to-end), or when deciding how to prove a change works across stack.config.ts options.
---

# Test a change

Payload Stack is tested across every `src/stack.config.ts` option, not only the one this project
uses today. A change is done when the suite that covers it is extended and `pnpm verify` passes.

| Suite | Command | Needs | Lives in |
| --- | --- | --- | --- |
| Unit | `pnpm test:unit` | nothing | `tests/unit/*.spec.ts(x)` |
| Integration | `pnpm test:int` | PostgreSQL on 5433 (`docker compose up -d`) | `tests/int/*.int.spec.ts` |
| End-to-end | `pnpm test:e2e` | the same database; starts its own dev server on `E2E_PORT` | `tests/e2e/*.e2e.spec.ts` |

`pnpm verify` runs typecheck, lint and the unit suite: the loop to run after every change. Run the
integration suite when you touch access control, tenancy, auth or hooks; run end-to-end when you
change a page or a flow. Test settings come from `test.env` (loaded over `.env`), so the suites
never touch the development database.

## Which suite

- **Unit**: anything that reads `stack.features.*`, pure functions, server actions with faked
  Payload, rendering of components. Fast; most tests belong here.
- **Integration**: real Payload and Better Auth against a real database. Isolation between
  organizations, access rules, hooks, emails being sent.
- **End-to-end**: a user journey in the browser. One per flow, not one per field.

## Unit: test under every configuration

Modules read `stack.config.ts` at import time, so import them per configuration:

```ts
import { presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

it.each(Object.entries(presets))('%s: shows Invoices only with billing', async (_name, preset) => {
  const { mainNav } = await loadWithStack(preset, () => import('@/components/dashboard/nav-config'))
  // assert against the preset
})
```

- Never import the module under test at the top of the file; use the value `loadWithStack` returns.
- `presets` are representative products (`defaults`, `orgs-off`, `billing-org`, `invite-only`, ...);
  `configMatrix()` is every combination of the discrete options. Add a preset in
  `tests/helpers/stack-fixtures.ts` when you add an option to the schema in `src/lib/stack.ts`.
- `loadWithEnv` does the same for environment variables. `tests/unit/setup.ts` clears Stripe,
  Resend and social variables so a developer's `.env` cannot change the result.
- Server actions: copy `loadProjectActions` in `tests/unit/actions.spec.ts`, which fakes the
  session, Payload and `@/lib/tenancy` with `vi.doMock`.

## Integration

Helpers are in `tests/helpers/int.ts`: `getTestPayload`, `signUp`, `signIn`, `makeAdmin`,
`createOrganization`, `cookieHeader`, `withCookie`, `captureEmails`, `firstUrl`, `tokenFromUrl`,
`expectApiError`, `uniqueEmail`.

- Prove access with `overrideAccess: false` and `user`: that is the path the REST API, GraphQL and
  the admin take.
- Use `cookieHeader` rather than raw `set-cookie`: it drops Better Auth's five-minute
  `session_data` cache, which otherwise makes revoked sessions and a changed active organization
  look stale.
- Use unique emails and names; tests share one database per run.

## End-to-end

Import `test`, `expect` and helpers from `tests/e2e/fixtures.ts`, not from `@playwright/test`.

- The `member` fixture is a signed-in user with an active organization, set up through the HTTP
  API; `account` is a signed-in user that may have none. Set state through the `*ViaApi` helpers
  and spend browser time only on what the test is about.
- Skip journeys the configuration cannot have:
  `test.skip(!stack.features.organizations, 'organizations are disabled in stack.config.ts')`.
- Prefer roles and labels (`getByRole('heading', { name })`). Next's route announcer duplicates
  headings, so a bare `getByText` on a title can match twice.
- `tests/e2e/global-setup.ts` creates the site admin from `E2E_ADMIN_EMAIL` /
  `E2E_ADMIN_PASSWORD`; use `adminCredentials()` for admin journeys.

## Rules

- When a flag, plan, route or email changes, extend the matching spec and preset. Do not delete or
  loosen an assertion to make a change pass; if an assertion is wrong, say why in the change.
- One behaviour per test, named for the behaviour.
- A failing test that is unrelated to your change is reported, not silenced.

Guide: https://payload.solutions/docs/payload-stack/testing
