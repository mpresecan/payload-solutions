'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { captureError } from '@/lib/observability'
import stack from '@/stack.config'

/**
 * Catches render errors below the frontend layout. Next.js has already reported the underlying
 * exception through `onRequestError` when it happened on the server; reporting again here adds the
 * client's view of it — and it is the only report at all for errors thrown during hydration.
 *
 * `digest` is the id Next.js gives the server-side error: showing it lets a user quote something
 * you can search for, without exposing the stack trace.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, {
      source: 'react-error-boundary',
      level: 'error',
      tags: { digest: error.digest ?? 'none' },
    })
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The error has been recorded. Try again, and if it keeps happening let us know at{' '}
        <a className="underline underline-offset-4" href={`mailto:${stack.support.email}`}>
          {stack.support.email}
        </a>
        .
      </p>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button onClick={reset}>Try again</Button>
    </main>
  )
}
