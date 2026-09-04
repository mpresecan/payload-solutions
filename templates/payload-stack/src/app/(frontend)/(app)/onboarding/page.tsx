import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Logo } from '@/components/marketing/logo'
import { requireSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import { listUserOrganizations } from '@/lib/tenancy'
import stack from '@/stack.config'
import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = { title: 'Welcome' }

export default async function OnboardingPage() {
  const session = await requireSession(paths.onboarding)
  if (!stack.features.organizations) redirect(paths.dashboard.home)

  const organizations = await listUserOrganizations()
  if (organizations.length > 0) redirect(paths.dashboard.home)

  const suggestedName = session.user.name ? `${session.user.name.split(' ')[0]}'s team` : 'My team'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Logo />
      <OnboardingForm suggestedName={suggestedName} />
    </main>
  )
}
