/**
 * Shared helpers for the Playwright journeys.
 *
 * Users, organizations and invitations are created through Better Auth's HTTP API with
 * `page.request`, which shares the browser context's cookie jar: after `signUpViaApi(page)` the
 * page is signed in, so a journey can start on the screen it is about, not on the sign-up form.
 */
import { expect, test as base, type Page } from '@playwright/test'

import stack from '@/stack.config'

export { expect }

export const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const PASSWORD = 'Long-Enough-Passw0rd!'

export function stamp(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${stamp()}@example.test`
}

export type E2EUser = { id: string; name: string; email: string; password: string }
export type E2EOrg = { id: string; name: string; slug: string }

async function authPost<T = Record<string, unknown>>(page: Page, path: string, data: Record<string, unknown>): Promise<T> {
  const response = await page.request.post(`${BASE}/api/auth/${path}`, { data, headers: { origin: BASE } })
  if (!response.ok()) throw new Error(`POST /api/auth/${path} → ${response.status()} ${await response.text()}`)
  return (await response.json()) as T
}

async function authGet<T = Record<string, unknown>>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`${BASE}/api/auth/${path}`, { headers: { origin: BASE } })
  if (!response.ok()) throw new Error(`GET /api/auth/${path} → ${response.status()} ${await response.text()}`)
  return (await response.json()) as T
}

/** Creates a user and signs the browser context in. */
export async function signUpViaApi(page: Page, opts: Partial<Pick<E2EUser, 'name' | 'email' | 'password'>> = {}): Promise<E2EUser> {
  const user = { name: opts.name ?? 'E2E Tester', email: opts.email ?? uniqueEmail(), password: opts.password ?? PASSWORD }
  const result = await authPost<{ user: { id: string } }>(page, 'sign-up/email', user)
  return { ...user, id: String(result.user.id) }
}

export async function signInViaApi(page: Page, email: string, password = PASSWORD): Promise<void> {
  await authPost(page, 'sign-in/email', { email, password })
}

export async function signOutViaApi(page: Page): Promise<void> {
  await authPost(page, 'sign-out', {})
}

export async function getSessionViaApi(page: Page) {
  const response = await page.request.get(`${BASE}/api/auth/get-session`, { headers: { origin: BASE } })
  const body = (await response.text()) || 'null'
  return JSON.parse(body) as { user: { id: string; email: string; name: string }; session: { activeOrganizationId?: string | null } } | null
}

/** Creates an organization for the signed-in user and makes it active. */
export async function createOrgViaApi(page: Page, name = 'E2E Org'): Promise<E2EOrg> {
  const slug = `org-${stamp()}`
  const org = await authPost<{ id: string; name: string; slug: string }>(page, 'organization/create', { name: `${name} ${slug.slice(-4)}`, slug })
  await authPost(page, 'organization/set-active', { organizationId: org.id })
  return { id: String(org.id), name: org.name, slug: org.slug }
}

/**
 * Gets a freshly signed-up user past onboarding: with organizations on, the dashboard needs an
 * active one; without, there is nothing to do.
 */
export async function dashboardReadyViaApi(page: Page, name?: string): Promise<E2EOrg | null> {
  return stack.features.organizations ? createOrgViaApi(page, name) : null
}

export async function setActiveOrgViaApi(page: Page, organizationId: string | null): Promise<void> {
  await authPost(page, 'organization/set-active', { organizationId })
}

export async function inviteViaApi(page: Page, organizationId: string, email: string, role: 'member' | 'admin' | 'owner' = 'member') {
  return authPost<{ id: string; email: string; role: string; status: string }>(page, 'organization/invite-member', { email, role, organizationId })
}

export async function acceptInvitationViaApi(page: Page, invitationId: string): Promise<void> {
  await authPost(page, 'organization/accept-invitation', { invitationId })
}

export async function listOrganizationsViaApi(page: Page) {
  return authGet<Array<{ id: string; name: string; slug: string }>>(page, 'organization/list')
}

/** The table row for a project on /dashboard/projects (the name cell and the delete button both carry the name). */
export function projectRow(page: Page, name: string) {
  return page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) })
}

export async function createProjectViaUi(page: Page, name: string, description?: string): Promise<void> {
  await page.goto(`${BASE}/dashboard/projects`)
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  if (description) await page.getByRole('textbox', { name: 'Description' }).fill(description)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(projectRow(page, name)).toBeVisible()
}

/**
 * Two starting points for journeys:
 * - `account`: a signed-in user ready for the dashboard, with an active organization when
 *   `stack.features.organizations` is on (and `org: null` when it is off). Journeys every product
 *   has (dashboard, projects, settings) start here and assert what the config implies.
 * - `member`: a signed-in member of one organization, for journeys about organizations. Asking for
 *   it skips the journey when organizations are off: there is nothing to test.
 */
export const test = base.extend<{ account: { user: E2EUser; org: E2EOrg | null }; member: { user: E2EUser; org: E2EOrg } }>({
  page: async ({ page }, use) => {
    // With Payload Consent the cookie banner opens bottom-left, over the sidebar's user menu. A
    // visitor answers it once; the journeys answer it whenever it shows up in their way. Without the
    // consent plugin there is no banner and the handler never runs.
    await page.addLocatorHandler(page.getByRole('region', { name: 'Your privacy choices' }), async (banner) => {
      await banner.getByRole('button', { name: 'Reject all' }).click()
    })
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture `use`, not a React hook
    await use(page)
  },
  account: async ({ page }, use) => {
    const user = await signUpViaApi(page)
    const org = stack.features.organizations ? await createOrgViaApi(page) : null
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture `use`, not a React hook
    await use({ user, org })
  },
  member: async ({ page }, use, testInfo) => {
    testInfo.skip(!stack.features.organizations, 'organizations are disabled in stack.config.ts')
    const user = await signUpViaApi(page)
    const org = await createOrgViaApi(page)
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture `use`, not a React hook
    await use({ user, org })
  },
})

/** Credentials of the site admin created by global-setup.ts. */
export function adminCredentials(): { email: string; password: string } {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) throw new Error('E2E admin credentials missing: is tests/e2e/global-setup.ts configured in playwright.config.ts?')
  return { email, password }
}
