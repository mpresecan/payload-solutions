import { CreditCardIcon } from 'lucide-react'

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

/**
 * Shown on the billing pages when stack.config.ts enables Stripe billing but the server has no
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET. Without the keys the billing plugin is not registered
 * (see Providers `billingReady`), so the Better Auth UI billing tab would throw on an unknown path.
 */
export function BillingNotConfigured() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CreditCardIcon />
        </EmptyMedia>
        <EmptyTitle>Billing is not configured</EmptyTitle>
        <EmptyDescription>
          Stripe billing is enabled in stack.config.ts, but the server is missing its Stripe keys. Set the
          variables below in .env and restart the dev server to turn on plans, checkout and the customer portal.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <pre className="rounded-md bg-muted px-4 py-3 text-left font-mono text-xs leading-relaxed">
          {'STRIPE_SECRET_KEY=sk_test_...\nSTRIPE_WEBHOOK_SECRET=whsec_...  # stripe listen --forward-to localhost:3000/api/auth/stripe/webhook'}
        </pre>
        <p className="text-xs text-muted-foreground">
          To ship without billing, set <code className="font-mono">billing.provider</code> to{' '}
          <code className="font-mono">&apos;none&apos;</code> in stack.config.ts and this page disappears from the
          navigation.
        </p>
      </EmptyContent>
    </Empty>
  )
}
