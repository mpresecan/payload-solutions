'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from '@phosphor-icons/react'

type Theme = 'light' | 'dark'

function resolveTheme(): Theme {
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced === 'light' || forced === 'dark') return forced
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Re-render when the system preference or the pinned `data-theme` attribute changes. */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => {
    mq.removeEventListener('change', onChange)
    observer.disconnect()
  }
}

/**
 * Light / dark toggle. The site follows the system by default; a click pins a theme and stores it.
 * The theme is only known on the client, so the button stays hidden until hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, resolveTheme, () => null)

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('ps-theme', next)
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme ? (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') : 'Toggle theme'}
      className={`inline-flex h-9 w-9 items-center justify-center text-fg-muted transition-colors hover:text-fg ${className ?? ''}`}
      style={{ visibility: theme ? 'visible' : 'hidden' }}
    >
      {theme ? theme === 'dark' ? <Sun size={18} /> : <Moon size={18} /> : <span className="block h-[18px] w-[18px]" aria-hidden />}
    </button>
  )
}
