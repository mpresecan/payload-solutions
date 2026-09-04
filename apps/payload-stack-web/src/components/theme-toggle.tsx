'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from '@phosphor-icons/react'

type Theme = 'light' | 'dark'

function resolveTheme(): Theme {
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced === 'light' || forced === 'dark') return forced
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Light / dark toggle. The site follows the system by default; a click pins a theme and stores it.
 * Rendered as an icon-only button, so we hide it until mounted to avoid a wrong icon flash.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(resolveTheme())
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!document.documentElement.getAttribute('data-theme')) setTheme(resolveTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('ps-theme', next)
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`inline-flex h-9 w-9 items-center justify-center text-fg-muted transition-colors hover:text-fg ${className ?? ''}`}
      style={{ visibility: theme ? 'visible' : 'hidden' }}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
