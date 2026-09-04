import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Auth } from '@/components/auth/auth'
import { Logo } from '@/components/marketing/logo'

/**
 * All authentication screens: /auth/sign-in, /auth/sign-up, /auth/forgot-password,
 * /auth/reset-password, /auth/verify-email, /auth/magic-link, /auth/accept-invitation, ...
 * The <Auth> router resolves the view from the path segment.
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
  'magic-link',
  'magic-link-sent',
  'two-factor',
  'accept-invitation',
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
