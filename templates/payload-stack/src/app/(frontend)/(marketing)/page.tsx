import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import stack from '@/stack.config'

/**
 * Minimal homepage. Everything here reads from stack.config.ts; replace the copy with yours.
 */
export default async function HomePage() {
  const session = await getSession()
  const primaryHref = session ? paths.dashboard.home : stack.auth.allowSignUp ? paths.auth.signUp : paths.auth.signIn

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
        <div className="max-w-2xl">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{stack.tagline}</h1>
          <p className="mt-6 text-pretty text-lg text-muted-foreground">{stack.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={primaryHref}>
                {session ? 'Open dashboard' : 'Get started'}
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            {stack.features.billing ? (
              <Button asChild size="lg" variant="outline">
                <Link href={paths.pricing}>See pricing</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            {
              title: 'Sign in your way',
              body: `${[
                stack.features.emailPassword && 'email and password',
                stack.features.magicLink && 'magic links',
                stack.features.passkeys && 'passkeys',
                stack.auth.social.length > 0 && stack.auth.social.join(', '),
              ]
                .filter(Boolean)
                .join(', ')}${stack.features.twoFactor ? ', with two-factor authentication.' : '.'}`,
            },
            stack.features.organizations
              ? {
                  title: 'Built for teams',
                  body: 'Create an organization, invite your team and switch between workspaces. Every piece of data stays with the organization that owns it.',
                }
              : {
                  title: 'Your account, your data',
                  body: 'Everything you create belongs to your account and stays private to you.',
                },
            stack.features.billing
              ? {
                  title: 'Simple pricing',
                  body: `Plans that grow with you${stack.billing.provider === 'stripe' && stack.billing.plans.some((p) => p.trialDays) ? ', starting with a free trial' : ''}. Cancel any time from your billing settings.`,
                }
              : {
                  title: 'Free while in preview',
                  body: 'No credit card required. Create an account and start right away.',
                },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="text-lg font-medium">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
