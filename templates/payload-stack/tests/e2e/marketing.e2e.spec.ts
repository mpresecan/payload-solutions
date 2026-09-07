/**
 * Public pages: homepage, navigation, pricing, legal pages and the 404s that keep unknown routes
 * from rendering. Everything here is driven by stack.config.ts (see tests/unit for every option;
 * this checks the shipped configuration end to end in a browser).
 */
import stack from '@/stack.config'
import { BASE, expect, signUpViaApi, test } from './fixtures'

test.describe('homepage', () => {
  test('renders the tagline, the sign-in methods and the primary call to action', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(stack.tagline)
    await expect(page.getByText(stack.description)).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i }).first()).toHaveAttribute('href', '/auth/sign-up')
    await expect(page.getByRole('heading', { name: 'Sign in your way' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Built for teams' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Simple pricing' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'See pricing' })).toHaveAttribute('href', '/pricing')
  })

  test('header shows the configured navigation and sign-in links, footer shows legal pages', async ({ page }) => {
    await page.goto(BASE)
    const nav = page.getByRole('navigation', { name: 'Primary' })
    for (const item of stack.nav) await expect(nav.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/sign-in')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/auth/sign-up')

    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    await expect(footer.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/legal/terms')
    await expect(footer.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/legal/cookies')
    await expect(footer.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', `mailto:${stack.support.email}`)
    await expect(footer.getByText(`Copyright ${new Date().getFullYear()} ${stack.legal.company}`)).toBeVisible()
  })

  test('signed-in visitors get "Open dashboard" instead of sign-in links', async ({ page }) => {
    await signUpViaApi(page)
    await page.goto(BASE)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/dashboard')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('link', { name: /open dashboard/i })).toBeVisible()
  })
})

test.describe('pricing', () => {
  test('lists every plan from stack.config.ts with monthly and yearly prices', async ({ page }) => {
    test.skip(stack.billing.provider !== 'stripe', 'billing is disabled in stack.config.ts')
    const plans = stack.billing.provider === 'stripe' ? stack.billing.plans : []
    await page.goto(`${BASE}/pricing`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pricing')
    for (const plan of plans) {
      await expect(page.getByText(plan.name, { exact: true })).toBeVisible()
      for (const feature of plan.features) await expect(page.getByText(feature).first()).toBeVisible()
      if (plan.trialDays) await expect(page.getByRole('paragraph').filter({ hasText: `${plan.trialDays}-day free trial` })).toBeVisible()
    }
    await expect(page.getByText('$29', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Yearly' }).click()
    await expect(page.getByText('$290', { exact: true })).toBeVisible()
    await expect(page.getByText('$990', { exact: true })).toBeVisible()
    // Visitors are sent to sign-up and then to the billing page that matches billing.attachedTo.
    const billingPath = stack.features.billingAttachedTo === 'organization' ? '/dashboard/organization/billing' : '/dashboard/settings/billing'
    await expect(page.getByRole('link', { name: 'Start free trial' })).toHaveAttribute('href', `/auth/sign-up?redirectTo=${encodeURIComponent(billingPath)}`)
  })
})

test.describe('legal pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
  })

  for (const [slug, title] of [
    ['privacy', 'Privacy Policy'],
    ['terms', 'Terms of Service'],
    ['cookies', 'Cookie Policy'],
  ] as const) {
    test(`/legal/${slug} renders the seeded ${title}`, async ({ page }) => {
      await page.goto(`${BASE}/legal/${slug}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
      await expect(page.getByText(/^Effective /)).toBeVisible()
      await expect(page.locator('article h2').first()).toBeVisible()
      // The seed writes the company into privacy and terms, the product name into all three.
      await expect(page.locator('article')).toContainText(slug === 'cookies' ? stack.name : stack.legal.company)
    })
  }

  test('unknown legal slugs are 404', async ({ page }) => {
    const response = await page.goto(`${BASE}/legal/does-not-exist`)
    expect(response?.status()).toBe(404)
  })
})

test.describe('unknown routes', () => {
  test('unknown auth views are 404', async ({ page }) => {
    for (const path of ['/auth/login', '/auth/register']) {
      const response = await page.goto(`${BASE}${path}`)
      expect(response?.status(), path).toBe(404)
    }
  })

  test('unknown settings, organization and admin tabs are 404 for a member', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    for (const path of ['/dashboard/settings/nope', '/dashboard/organization/nope', '/dashboard/organization/teams', '/dashboard/admin/nope', '/dashboard/admin/users']) {
      const response = await page.goto(`${BASE}${path}`)
      expect(response?.status(), path).toBe(404)
    }
  })
})
