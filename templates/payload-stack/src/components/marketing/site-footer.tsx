import Link from 'next/link'

import { Logo } from '@/components/marketing/logo'
import { ConsentSettingsLink } from '@/consent/consent-settings-link'
import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'
import stack from '@/stack.config'

async function legalLinks() {
  try {
    const payload = await getPayloadClient()
    const pages = await payload.find({
      collection: 'legal-pages',
      where: { showInFooter: { equals: true } },
      select: { title: true, slug: true },
      sort: 'title',
      limit: 10,
      overrideAccess: true,
    })
    return pages.docs
  } catch {
    return []
  }
}

export async function SiteFooter() {
  const legal = await legalLinks()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{stack.tagline}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {stack.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={paths.auth.signIn} className="hover:text-foreground">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium">Legal</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {legal.map((page) => (
              <li key={page.slug}>
                <Link href={paths.legal(page.slug)} className="hover:text-foreground">
                  {page.title}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${stack.support.email}`} className="hover:text-foreground">
                Contact support
              </a>
            </li>
            {/* Renders its own <li>, or nothing at all without Payload Consent. */}
            <ConsentSettingsLink />
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Copyright {year} {stack.legal.company}. All rights reserved.
          </p>
          <p>
            Built with{' '}
            <a href="https://www.payloadstack.com" className="underline underline-offset-4 hover:text-foreground">
              Payload Stack
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
