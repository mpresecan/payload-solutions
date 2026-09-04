import Link from 'next/link'

import { Logo } from '@/components/marketing/logo'
import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/auth/session'
import { paths } from '@/lib/paths'
import stack from '@/stack.config'

export async function SiteHeader() {
  const session = await getSession()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {stack.nav.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <Button asChild>
              <Link href={paths.dashboard.home}>Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href={paths.auth.signIn}>Sign in</Link>
              </Button>
              {stack.auth.allowSignUp ? (
                <Button asChild>
                  <Link href={paths.auth.signUp}>Get started</Link>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
