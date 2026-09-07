'use client'

import { Moon, Sun } from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/** `false` during SSR and hydration, `true` once the component renders on the client. */
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}

/**
 * Light / dark toggle backed by next-themes (shared with the Fumadocs docs layout).
 * The resolved theme is only known on the client, so the label and icon are derived after
 * hydration to keep server and client markup identical.
 */
export function ThemeToggle({
  className,
  variant = 'icon',
}: {
  className?: string
  /** `row` is the footer-column presentation: icon plus a label, styled like the links beside it. */
  variant?: 'icon' | 'row'
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()

  const dark = hydrated && resolvedTheme === 'dark'

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        className={`inline-flex items-center gap-2.5 text-fg transition-colors hover:text-accent ${className ?? ''}`}
        style={{ visibility: hydrated ? 'visible' : 'hidden' }}
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
        <span>{dark ? 'Light theme' : 'Dark theme'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={hydrated ? (dark ? 'Switch to light theme' : 'Switch to dark theme') : 'Toggle theme'}
      className={`inline-flex h-9 w-9 items-center justify-center text-fg-muted transition-colors hover:text-fg ${className ?? ''}`}
      style={{ visibility: hydrated ? 'visible' : 'hidden' }}
    >
      {hydrated ? dark ? <Sun size={18} /> : <Moon size={18} /> : <span className="block h-[18px] w-[18px]" aria-hidden />}
    </button>
  )
}
