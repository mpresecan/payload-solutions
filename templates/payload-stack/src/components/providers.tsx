'use client'

import { createStripeBillingAdapter } from '@better-auth-ui/core/plugins/billing'
import { QueryClientProvider } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ThemeProvider, useTheme } from 'next-themes'
import { useMemo, type ReactNode } from 'react'

import { AuthProvider } from '@/components/auth/auth-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { adminPlugin } from '@/lib/auth/admin-plugin'
import { apiKeyPlugin } from '@/lib/auth/api-key-plugin'
import { authClient } from '@/lib/auth/auth-client'
import type { AuthPlugin } from '@/lib/auth/auth-plugin'
import { billingPlugin } from '@/lib/auth/billing-plugin'
import { deleteUserPlugin } from '@/lib/auth/delete-user-plugin'
import { lastLoginMethodPlugin } from '@/lib/auth/last-login-method-plugin'
import { magicLinkPlugin } from '@/lib/auth/magic-link-plugin'
import { organizationPlugin } from '@/lib/auth/organization-plugin'
import { passkeyPlugin } from '@/lib/auth/passkey-plugin'
import { themePlugin } from '@/lib/auth/theme-plugin'
import { twoFactorPlugin } from '@/lib/auth/two-factor-plugin'
import { paths } from '@/lib/paths'
import { getQueryClient } from '@/lib/query-client'
import { toBillingPlans } from '@/lib/stack'
import stack from '@/stack.config'

/**
 * Client providers for the whole frontend: TanStack Query, next-themes and Better Auth UI.
 * The Better Auth UI plugin list is derived from stack.config.ts so a feature that is off in config
 * simply does not render (no billing tab, no organization switcher, no passkey card).
 */
export function Providers({ children, billingReady }: { children: ReactNode; billingReady: boolean }) {
  const router = useRouter()
  const queryClient = getQueryClient()

  const plugins = useMemo<AuthPlugin[]>(() => {
    const list: AuthPlugin[] = [
      adminPlugin(),
      lastLoginMethodPlugin(),
      themePlugin({ useTheme }),
      deleteUserPlugin(),
      apiKeyPlugin({ organization: stack.features.organizations }),
    ]
    if (stack.features.magicLink) list.push(magicLinkPlugin())
    if (stack.features.passkeys) list.push(passkeyPlugin())
    if (stack.features.twoFactor) list.push(twoFactorPlugin())
    if (stack.features.organizations) {
      list.push(
        organizationPlugin({
          creatorRole: stack.organizations.creatorRole,
          additionalRoles: stack.organizations.additionalRoles,
          logo: { enabled: true },
        }),
      )
    }
    if (stack.billing.provider === 'stripe' && billingReady) {
      list.push(
        billingPlugin({
          adapter: createStripeBillingAdapter(authClient, {
            plans: toBillingPlans(stack),
            successUrl: `${stack.url}${paths.dashboard.billing}?checkout=success`,
            cancelUrl: `${stack.url}${paths.dashboard.billing}?checkout=cancelled`,
            returnUrl: `${stack.url}${paths.dashboard.billing}`,
          }),
          user: stack.billing.attachedTo === 'user',
          organization: stack.billing.attachedTo === 'organization',
        }),
      )
    }
    return list
  }, [billingReady])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider
          authClient={authClient}
          baseURL={stack.url}
          basePaths={{
            auth: paths.auth.base,
            settings: paths.dashboard.settings,
            organization: paths.dashboard.organization,
            // Payload owns /admin; Better Auth UI's admin views live under the dashboard instead.
            admin: paths.dashboard.admin,
          }}
          redirectTo={paths.dashboard.home}
          emailAndPassword={{
            enabled: stack.features.emailPassword,
            requireEmailVerification: stack.auth.requireEmailVerification,
            confirmPassword: true,
            strengthMeter: true,
            name: true,
          }}
          socialProviders={stack.auth.social}
          navigate={({ to, replace }) => (replace ? router.replace(to) : router.push(to))}
          Link={Link}
          plugins={plugins}
        >
          <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
          <Toaster richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
