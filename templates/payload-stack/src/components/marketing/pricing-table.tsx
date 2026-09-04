'use client'

import { CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { paths } from '@/lib/paths'
import { formatPrice, type StackPlan } from '@/lib/stack'
import { cn } from '@/lib/utils'

/**
 * Pricing table driven by stack.config.ts. Checkout itself happens in the dashboard (billing
 * settings) once the visitor has an account and, if billing is per organization, an organization.
 */
export function PricingTable({ plans, signedIn }: { plans: StackPlan[]; signedIn: boolean }) {
  const hasYearly = plans.some((p) => p.prices.some((price) => price.interval === 'year'))
  const [interval, setInterval] = useState<'month' | 'year'>('month')

  return (
    <div className="space-y-8">
      {hasYearly ? (
        <div className="flex justify-center">
          <Tabs value={interval} onValueChange={(v) => setInterval(v as 'month' | 'year')}>
            <TabsList>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      <div className={cn('grid gap-6', plans.length > 1 ? 'md:grid-cols-2' : 'max-w-md mx-auto', plans.length > 2 ? 'lg:grid-cols-3' : '')}>
        {plans.map((plan) => {
          const price = plan.prices.find((p) => p.interval === interval) ?? plan.prices[0]!
          const target = signedIn ? paths.dashboard.billing : `${paths.auth.signUp}?redirectTo=${encodeURIComponent(paths.dashboard.billing)}`
          return (
            <Card key={plan.id} className={cn('flex flex-col', plan.highlighted && 'border-primary shadow-md')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Popular</span>
                  ) : null}
                </div>
                {plan.description ? <CardDescription>{plan.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div>
                  <span className="text-4xl font-semibold tracking-tight">{formatPrice(price.amount, price.currency)}</span>
                  <span className="text-muted-foreground">
                    {price.interval === 'one-time' ? ' once' : ` / ${price.interval}`}
                    {plan.seats ? ', per organization' : ''}
                  </span>
                  {plan.trialDays ? <p className="mt-1 text-sm text-muted-foreground">{plan.trialDays}-day free trial</p> : null}
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>
                  <Link href={target}>{plan.trialDays ? 'Start free trial' : 'Choose ' + plan.name}</Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
