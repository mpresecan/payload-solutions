import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The link may be out of date, or the page may have moved.
      </p>
      <Button asChild>
        <Link href="/">Back to the homepage</Link>
      </Button>
    </main>
  )
}
