/**
 * Onboarding, the dashboard shell and the Projects example: the first-run flow, sidebar
 * navigation derived from stack.config.ts, overview cards, and creating / deleting projects
 * that stay scoped to the active organization.
 */
import stack from '@/stack.config'
import {
  BASE,
  createOrgViaApi,
  createProjectViaUi,
  expect,
  getSessionViaApi,
  listOrganizationsViaApi,
  projectRow,
  setActiveOrgViaApi,
  signUpViaApi,
  test,
} from './fixtures'

test.describe('onboarding', () => {
  test('a new user is sent to onboarding, creates an organization and lands on the dashboard', async ({ page }) => {
    const user = await signUpViaApi(page, { name: 'Mira Lindqvist' })
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(/\/onboarding/, { timeout: 60_000 })

    const name = page.locator('#org-name')
    const slug = page.locator('#org-slug')
    await expect(name).toHaveValue("Mira's team")
    await expect(slug).toHaveValue('mira-s-team')

    await name.fill('Ridgeline')
    await expect(slug).toHaveValue('ridgeline')
    const uniqueSlug = `ridgeline-${Date.now().toString(36)}`
    await slug.fill(uniqueSlug)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForURL(stack.features.billingAttachedTo === 'organization' ? /\/dashboard\/organization\/billing/ : /\/dashboard$/, { timeout: 60_000 })

    const orgs = await listOrganizationsViaApi(page)
    expect(orgs.map((o) => o.slug)).toContain(uniqueSlug)
    const session = await getSessionViaApi(page)
    expect(String(session?.session.activeOrganizationId)).toBe(String(orgs.find((o) => o.slug === uniqueSlug)!.id))
    expect(user.id).toBeTruthy()

    // Onboarding is done: visiting it again goes straight to the dashboard.
    await page.goto(`${BASE}/onboarding`)
    await page.waitForURL(/\/dashboard$/, { timeout: 60_000 })
  })

  test('refuses a slug that is already taken and keeps the user on the form', async ({ page, browser }) => {
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await signUpViaApi(otherPage)
    const taken = await createOrgViaApi(otherPage)
    await other.close()

    await signUpViaApi(page)
    await page.goto(`${BASE}/onboarding`)
    await page.locator('#org-name').fill('Taken')
    await page.locator('#org-slug').fill(taken.slug)
    await page.getByRole('button', { name: /continue/i }).click()
    // Scoped to the form: Next's route announcer (#__next-route-announcer__) is a role="alert" too.
    await expect(page.locator('form').getByRole('alert')).toHaveText(/already exists|could not create/i)
    await expect(page).toHaveURL(/\/onboarding/)
  })
})

test.describe('dashboard shell', () => {
  test('shows the welcome, the overview cards and the sidebar for the enabled features', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard`)
    await expect(page.getByRole('heading', { name: /welcome back, E2E/i })).toBeVisible()
    await expect(page.getByText(`You are working in ${member.org.name}`)).toBeVisible()
    await expect(page.getByRole('link', { name: /manage projects/i })).toHaveAttribute('href', '/dashboard/projects')
    await expect(page.getByRole('link', { name: /invite people/i })).toHaveAttribute('href', '/dashboard/organization/people')
    if (stack.features.billing) {
      await expect(page.getByRole('link', { name: /manage billing/i })).toHaveAttribute(
        'href',
        stack.features.billingAttachedTo === 'organization' ? '/dashboard/organization/billing' : '/dashboard/settings/billing',
      )
    } else {
      await expect(page.getByRole('link', { name: /review security/i })).toBeVisible()
    }

    const sidebar = page.locator('[data-slot="sidebar"]').first()
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard')
    await expect(sidebar.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/dashboard/projects')
    await expect(sidebar.getByText('Organization', { exact: true })).toBeVisible()
    await expect(sidebar.getByText('Settings', { exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', /payload\.solutions/)
    await expect(sidebar.getByRole('link', { name: 'Support' })).toHaveAttribute('href', `mailto:${stack.support.email}`)
    await expect(sidebar.getByRole('link', { name: 'Payload admin' })).toHaveCount(0)
    // The organization switcher shows the active organization.
    await expect(sidebar.getByText(member.org.name)).toBeVisible()
    await expect(sidebar.getByText(member.org.slug)).toBeVisible()
    // The user menu shows who is signed in.
    await expect(sidebar.getByText(member.user.email)).toBeVisible()
  })

  test('sidebar sub-navigation links match the routes', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard`)
    const sidebar = page.locator('[data-slot="sidebar"]').first()
    const groups: Array<[group: string, children: Array<[label: string, href: string]>]> = [
      [
        'Organization',
        [
          ['General', '/dashboard/organization/settings'],
          ['People', '/dashboard/organization/people'],
          ...(stack.features.billingAttachedTo === 'organization' ? [['Billing', '/dashboard/organization/billing'] as [string, string]] : []),
        ],
      ],
      [
        'Settings',
        [
          ['Account', '/dashboard/settings/account'],
          ['Security', '/dashboard/settings/security'],
          ['Organizations', '/dashboard/settings/organizations'],
          ...(stack.features.billingAttachedTo === 'user' ? [['Billing', '/dashboard/settings/billing'] as [string, string]] : []),
        ],
      ],
    ]
    for (const [group, children] of groups) {
      // A group is expanded on its own pages; open it by visiting its first child.
      await page.goto(`${BASE}${children[0]![1]}`)
      const item = sidebar.getByRole('listitem').filter({ has: page.getByRole('link', { name: group, exact: true }) }).first()
      for (const [label, href] of children) await expect(item.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
      // Nothing else is offered in the group.
      await expect(item.getByRole('link')).toHaveCount(children.length + 1)
      // The current page is highlighted.
      await expect(item.getByRole('link', { name: children[0]![0], exact: true })).toHaveAttribute('data-active', 'true')
    }
  })

  test('the user menu offers account settings, theme toggle and sign out', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.getByRole('button', { name: new RegExp(member.user.email) }).click()
    await expect(page.getByRole('menuitem', { name: /account settings/i })).toHaveAttribute('href', '/dashboard/settings/account')
    await expect(page.getByRole('menuitem', { name: /dark theme|light theme/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /payload admin/i })).toHaveCount(0)
    await page.getByRole('menuitem', { name: /dark theme/i }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})

test.describe('projects', () => {
  test('creates a project, shows it in the list and on the overview count, then deletes it', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/projects`)
    await expect(page.getByText('No projects yet')).toBeVisible()

    await createProjectViaUi(page, 'Website redesign', 'Q4 launch')
    await expect(page.getByText('Q4 launch')).toBeVisible()
    await expect(projectRow(page, 'Website redesign')).toContainText('active')
    await expect(page.getByText('Project created')).toBeVisible()

    await page.goto(`${BASE}/dashboard`)
    const projectsCard = page.getByText('Projects', { exact: true }).locator('..')
    await expect(projectsCard.getByText('1', { exact: true })).toBeVisible()

    await page.goto(`${BASE}/dashboard/projects`)
    await page.getByRole('button', { name: 'Delete Website redesign' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Delete Website redesign?')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(projectRow(page, 'Website redesign')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Website redesign' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Project deleted')).toBeVisible()
    await expect(page.getByText('No projects yet')).toBeVisible()
    expect(member.org.id).toBeTruthy()
  })

  test('validates the name and keeps the description optional', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard/projects`)
    const name = page.getByRole('textbox', { name: 'Name' })
    // Native validation blocks a single character (minLength=2).
    await name.fill('a')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByText('No projects yet')).toBeVisible()
    await name.fill('Ok name')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(projectRow(page, 'Ok name')).toBeVisible()
    await expect(name).toHaveValue('')
  })

  test('projects belong to the active organization: switching organizations changes the list', async ({ page, member }) => {
    await createProjectViaUi(page, `Only in ${member.org.name}`)
    const second = await createOrgViaApi(page, 'Second org')

    await page.goto(`${BASE}/dashboard/projects`)
    await expect(page.getByText('No projects yet')).toBeVisible()
    await createProjectViaUi(page, 'Only in second')

    await setActiveOrgViaApi(page, member.org.id)
    await page.goto(`${BASE}/dashboard/projects`)
    await expect(projectRow(page, `Only in ${member.org.name}`)).toBeVisible()
    await expect(projectRow(page, 'Only in second')).toHaveCount(0)
    expect(second.id).not.toBe(member.org.id)
  })

  test('switching organizations from the sidebar re-renders server data', async ({ page, member }) => {
    await createProjectViaUi(page, 'First org project')
    const second = await createOrgViaApi(page, 'Switch target')
    await setActiveOrgViaApi(page, member.org.id)

    await page.goto(`${BASE}/dashboard/projects`)
    await expect(projectRow(page, 'First org project')).toBeVisible()
    const sidebar = page.locator('[data-slot="sidebar"]').first()
    await sidebar.getByRole('button', { name: new RegExp(member.org.name) }).click()
    await page.getByRole('menuitem', { name: new RegExp(second.name) }).click()
    await expect(sidebar.getByText(second.name)).toBeVisible()
    await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 30_000 })
  })
})
