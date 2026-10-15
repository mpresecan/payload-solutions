import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Auth } from '@/components/auth/auth'
import { Logo } from '@/components/marketing/logo'
import stack from '@/stack.config'

/**
 * All authentication screens: /auth/sign-in, /auth/sign-up, /auth/forgot-password,
 * /auth/reset-password, /auth/verify-email, /auth/magic-link, /auth/accept-invitation, ...
 * The <Auth> router resolves the view from the path segment.
 */

/**
 * Only the views this project's auth configuration provides. A view whose plugin is off (magic
 * link without `'magic-link'` in `auth.methods`, two-factor, invitations without organizations)
 * has no component to render, so prerendering it would throw "Unknown view" and fail the build.
 */
const KNOWN = new Set([
  'sign-in',
  'sign-up',
  'sign-out',
  'forgot-password',
  'reset-password',
  'reset-link-sent',
  'verify-email',
  'callback',
  'error',
  'redirect',
  ...(stack.features.magicLink ? ['magic-link', 'magic-link-sent'] : []),
  ...(stack.features.twoFactor ? ['two-factor'] : []),
  ...(stack.features.organizations ? ['accept-invitation'] : []),
])

type Params = { params: Promise<{ path: string }> }

export function generateStaticParams() {
  return [...KNOWN].map((path) => ({ path }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params
  const title = path
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { title }
}

export default async function AuthPage({ params }: Params) {
  const { path } = await params
  if (!KNOWN.has(path)) notFound()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Logo />
      <Auth path={path} className="w-full max-w-sm" />
    </main>
  )
}
