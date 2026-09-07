// @vitest-environment jsdom
/**
 * Interactive client components rendered in jsdom:
 *   - src/components/marketing/pricing-table.tsx (interval toggle, per-plan copy, call to action)
 *   - src/app/(frontend)/(app)/onboarding/onboarding-form.tsx (create org → set active → complete → route)
 *   - src/app/(frontend)/(app)/dashboard/projects/project-form.tsx and delete-button.tsx
 *   - src/components/dashboard/active-organization-sync.tsx
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PricingTable } from '@/components/marketing/pricing-table'
import { paths } from '@/lib/paths'
import { defineStack, type StackInput, type StackPlan } from '@/lib/stack'
import { base, plans, presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const toast = { success: vi.fn(), error: vi.fn() }
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

afterEach(() => {
  cleanup()
  router.push.mockClear()
  router.refresh.mockClear()
  toast.success.mockClear()
  toast.error.mockClear()
})

const stackPlans = (input: StackInput = { ...base, billing: { provider: 'stripe', plans } }): StackPlan[] => {
  const stack = defineStack(input)
  return stack.billing.provider === 'stripe' ? stack.billing.plans : []
}

describe('PricingTable', () => {
  it('lists every plan with monthly prices, features, seat and trial copy', () => {
    render(<PricingTable plans={stackPlans()} signedIn={false} />)
    expect(screen.getByText('Starter')).toBeTruthy()
    expect(screen.getByText('Team')).toBeTruthy()
    expect(screen.getByText('$29')).toBeTruthy()
    expect(screen.getByText('$99')).toBeTruthy()
    expect(screen.getAllByText(/\/ month/)).toHaveLength(2)
    expect(screen.getByText(/, per organization/)).toBeTruthy()
    expect(screen.getByText('14-day free trial')).toBeTruthy()
    expect(screen.getByText('Popular')).toBeTruthy()
    for (const feature of ['Up to 3 members', '10 projects', 'Up to 25 members', 'Unlimited projects']) expect(screen.getByText(feature)).toBeTruthy()
  })

  it('switches to yearly prices, falling back to the first price for plans without one', () => {
    render(<PricingTable plans={stackPlans()} signedIn={false} />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Yearly' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Yearly' }))
    expect(screen.getByText('$990')).toBeTruthy()
    expect(screen.getByText(/\/ year/)).toBeTruthy()
    // Starter has no yearly price: it keeps showing its monthly price.
    expect(screen.getByText('$29')).toBeTruthy()
  })

  it('hides the interval toggle when no plan has a yearly price', () => {
    const monthlyOnly = stackPlans({ ...base, billing: { provider: 'stripe', plans: [plans[0]!] } })
    render(<PricingTable plans={monthlyOnly} signedIn={false} />)
    expect(screen.queryByRole('tab', { name: 'Yearly' })).toBeNull()
  })

  it('labels one-time prices as "once"', () => {
    const lifetime = stackPlans({
      ...base,
      billing: { provider: 'stripe', plans: [{ id: 'lifetime', name: 'Lifetime', prices: [{ id: 'price_l', amount: 49900, interval: 'one-time' }] }] },
    })
    render(<PricingTable plans={lifetime} signedIn={false} />)
    expect(screen.getByText('$499')).toBeTruthy()
    expect(screen.getByText('$499').parentElement!.textContent).toContain('once')
    expect(screen.getByText('$499').parentElement!.textContent).not.toContain('/')
    expect(screen.getByRole('link', { name: 'Choose Lifetime' })).toBeTruthy()
  })

  it.each([
    ['billing-org', paths.dashboard.organizationBilling],
    ['billing-user-with-orgs', paths.dashboard.billing],
    ['billing-user-no-orgs', paths.dashboard.billing],
  ] as const)('under %s sends visitors to sign-up (returning to billing) and members straight to %s', async (preset, billingPath) => {
    // The call to action depends on billing.attachedTo, so the component is loaded per configuration.
    const { PricingTable: Table } = await loadWithStack(presets[preset], () => import('@/components/marketing/pricing-table'))
    const { unmount } = render(<Table plans={stackPlans(presets[preset])} signedIn={false} />)
    const trial = screen.getByRole('link', { name: 'Start free trial' })
    expect(trial.getAttribute('href')).toBe(`${paths.auth.signUp}?redirectTo=${encodeURIComponent(billingPath)}`)
    expect(screen.getByRole('link', { name: 'Choose Starter' })).toBeTruthy()
    unmount()

    render(<Table plans={stackPlans(presets[preset])} signedIn />)
    expect(screen.getByRole('link', { name: 'Start free trial' }).getAttribute('href')).toBe(billingPath)
  })
})

describe('OnboardingForm', () => {
  const authClient = {
    organization: {
      create: vi.fn(),
      setActive: vi.fn(async () => ({ data: {}, error: null })),
    },
  }
  const completeOnboarding = vi.fn(async () => ({ ok: true as const }))

  async function renderForm(input: StackInput) {
    vi.doMock('@/lib/auth/auth-client', () => ({ authClient }))
    vi.doMock('@/app/(frontend)/(app)/onboarding/actions', () => ({ completeOnboarding }))
    const { OnboardingForm } = await loadWithStack(input, () => import('@/app/(frontend)/(app)/onboarding/onboarding-form'))
    vi.doUnmock('@/lib/auth/auth-client')
    vi.doUnmock('@/app/(frontend)/(app)/onboarding/actions')
    render(<OnboardingForm suggestedName="Mira's team" />)
  }

  afterEach(() => {
    authClient.organization.create.mockReset()
    authClient.organization.setActive.mockClear()
    completeOnboarding.mockClear()
  })

  it('suggests a slug from the name and keeps a hand-edited slug', () => {
    return renderForm(presets.defaults).then(() => {
      const name = screen.getByLabelText('Name') as HTMLInputElement
      const slug = screen.getByLabelText('URL slug') as HTMLInputElement
      expect(name.value).toBe("Mira's team")
      expect(slug.value).toBe('mira-s-team')

      fireEvent.change(name, { target: { value: 'Acme Corp' } })
      expect(slug.value).toBe('acme-corp')

      fireEvent.change(slug, { target: { value: 'custom' } })
      fireEvent.change(name, { target: { value: 'Acme Corporation' } })
      expect(slug.value).toBe('custom')
    })
  })

  it('creates the organization, activates it, completes onboarding and goes to the dashboard', async () => {
    authClient.organization.create.mockResolvedValue({ data: { id: 'org_1', name: 'Acme Corp' }, error: null })
    await renderForm(presets.defaults)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Acme Corp  ' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /continue/i }).closest('form')!)
    })
    await waitFor(() => expect(router.push).toHaveBeenCalled())
    expect(authClient.organization.create).toHaveBeenCalledWith({ name: 'Acme Corp', slug: 'acme-corp' })
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: 'org_1' })
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Acme Corp is ready')
    expect(router.push).toHaveBeenCalledWith(paths.dashboard.home)
    expect(router.refresh).toHaveBeenCalled()
  })

  it('goes to organization billing instead when billing is attached to organizations', async () => {
    authClient.organization.create.mockResolvedValue({ data: { id: 'org_1', name: 'Acme' }, error: null })
    await renderForm(presets['billing-org'])
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /continue/i }).closest('form')!)
    })
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(paths.dashboard.organizationBilling))
  })

  it('shows the server error and stops when creation fails', async () => {
    authClient.organization.create.mockResolvedValue({ data: null, error: { message: 'Slug is taken' } })
    await renderForm(presets.defaults)
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /continue/i }).closest('form')!)
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Slug is taken'))
    expect(authClient.organization.setActive).not.toHaveBeenCalled()
    expect(completeOnboarding).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('disables the button for names shorter than two characters', async () => {
    await renderForm(presets.defaults)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
    expect((screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('ProjectForm', () => {
  it('submits through the server action and resets on success', async () => {
    const createProject = vi.fn(async (_prev: unknown, fd: FormData) => (fd.get('name') === 'bad' ? { ok: false, error: 'Give the project a name' } : { ok: true }))
    vi.doMock('@/app/(frontend)/(app)/dashboard/projects/actions', () => ({ createProject }))
    vi.resetModules()
    const { ProjectForm } = await import('@/app/(frontend)/(app)/dashboard/projects/project-form')
    vi.doUnmock('@/app/(frontend)/(app)/dashboard/projects/actions')
    render(<ProjectForm />)

    const name = screen.getByLabelText('Name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'bad' } })
    await act(async () => {
      fireEvent.submit(name.closest('form')!)
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Give the project a name'))
    expect(toast.success).not.toHaveBeenCalled()

    fireEvent.change(name, { target: { value: 'Website redesign' } })
    await act(async () => {
      fireEvent.submit(name.closest('form')!)
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Project created'))
    expect(name.value).toBe('')
    expect(createProject).toHaveBeenCalledTimes(2)
  })
})

describe('DeleteProjectButton', () => {
  async function renderButton(result: { ok: boolean; error?: string }) {
    const deleteProject = vi.fn(async () => result)
    vi.doMock('@/app/(frontend)/(app)/dashboard/projects/actions', () => ({ deleteProject }))
    vi.resetModules()
    const { DeleteProjectButton } = await import('@/app/(frontend)/(app)/dashboard/projects/delete-button')
    vi.doUnmock('@/app/(frontend)/(app)/dashboard/projects/actions')
    render(<DeleteProjectButton id={5} name="Website" />)
    return deleteProject
  }

  it('asks for confirmation, then deletes and toasts', async () => {
    const deleteProject = await renderButton({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Website' }))
    expect(await screen.findByText('Delete Website?')).toBeTruthy()
    expect(deleteProject).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith(5))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Project deleted'))
  })

  it('cancelling does nothing', async () => {
    const deleteProject = await renderButton({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Website' }))
    await screen.findByText('Delete Website?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteProject).not.toHaveBeenCalled()
  })

  it('surfaces a failed deletion', async () => {
    await renderButton({ ok: false, error: 'Not allowed' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Website' }))
    await screen.findByText('Delete Website?')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not allowed'))
  })
})

describe('ActiveOrganizationSync', () => {
  async function renderSync(sessions: Array<{ session: { activeOrganizationId: string | null } } | undefined>) {
    let index = 0
    const useSession = vi.fn(() => ({ data: sessions[Math.min(index, sessions.length - 1)] }))
    vi.doMock('@better-auth-ui/react', () => ({ useSession }))
    vi.resetModules()
    const { ActiveOrganizationSync } = await import('@/components/dashboard/active-organization-sync')
    vi.doUnmock('@better-auth-ui/react')
    const view = render(<ActiveOrganizationSync />)
    return {
      next: () => {
        index += 1
        view.rerender(<ActiveOrganizationSync />)
      },
    }
  }

  it('refreshes server components only when the active organization changes after the first resolved session', async () => {
    const { next } = await renderSync([
      undefined,
      { session: { activeOrganizationId: 'org_1' } },
      { session: { activeOrganizationId: 'org_1' } },
      { session: { activeOrganizationId: 'org_2' } },
      { session: { activeOrganizationId: null } },
    ])
    expect(router.refresh).not.toHaveBeenCalled() // pending session
    next()
    expect(router.refresh).not.toHaveBeenCalled() // first resolved session: no refresh
    next()
    expect(router.refresh).not.toHaveBeenCalled() // same organization
    next()
    expect(router.refresh).toHaveBeenCalledTimes(1) // switched
    next()
    expect(router.refresh).toHaveBeenCalledTimes(2) // cleared
  })
})
