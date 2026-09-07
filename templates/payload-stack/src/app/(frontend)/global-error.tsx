'use client'

import { useEffect } from 'react'

import { captureError } from '@/lib/observability'

/**
 * The last line of defence: an error in the root layout itself, where no provider, theme or
 * stylesheet can be assumed to have loaded. It replaces the whole document, so it renders its own
 * <html> and <body> and uses inline styles rather than Tailwind classes.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureError(error, { source: 'global-error', level: 'fatal', tags: { digest: error.digest ?? 'none' } })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          gap: '1rem',
          justifyContent: 'center',
          margin: 0,
          minHeight: '100dvh',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ color: '#71717a', margin: 0, maxWidth: '28rem' }}>
          The application failed to load. The error has been recorded — please reload the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#0a0a0a',
            border: 0,
            borderRadius: 0,
            color: '#fafafa',
            cursor: 'pointer',
            font: 'inherit',
            padding: '0.5rem 1rem',
          }}
          type="button"
        >
          Reload
        </button>
      </body>
    </html>
  )
}
