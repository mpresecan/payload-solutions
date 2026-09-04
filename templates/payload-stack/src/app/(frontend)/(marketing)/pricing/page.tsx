import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PricingTable } from '@/components/marketing/pricing-table'
import { getSession } from '@/lib/auth/session'
import stack from '@/stack.config'

export const metadata: Metadata = { title: 'Pricing' }

export default async function PricingPage() {
  if (stack.billing.provider !== 'stripe') notFound()
  const session = await getSession()

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Pricing</h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          Pick a plan for your {stack.billing.attachedTo === 'organization' ? 'organization' : 'account'}. Change or
          cancel any time.
        </p>
      </div>
      <div className="mt-12">
        <PricingTable plans={stack.billing.plans} signedIn={Boolean(session)} />
      </div>
    </section>
  )
}
