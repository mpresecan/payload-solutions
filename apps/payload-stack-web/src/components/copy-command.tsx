'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { NPX_COMMAND } from '@payload-solutions/brand'
import { cn } from '@/lib/cn'

interface CopyCommandProps {
  className?: string
  /** Larger, hero-sized variant. */
  size?: 'md' | 'lg'
}

/**
 * The primary call to action on the whole site: the scaffold command, one click to copy.
 * Feedback state ("Copied") is the only motion here; it acknowledges the click.
 *
 * On narrow screens the command must stay readable, so the box stretches to its container
 * and the text is allowed to wrap onto a second line rather than being cut with an ellipsis.
 * From `sm` up it is a single, compact line.
 */
export function CopyCommand({ className, size = 'md' }: CopyCommandProps) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(NPX_COMMAND)
      } else {
        const ta = document.createElement('textarea')
        ta.value = NPX_COMMAND
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setFailed(false)
      setCopied(true)
    } catch {
      setFailed(true)
      setCopied(false)
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopied(false)
      setFailed(false)
    }, 1800)
  }, [])

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Command copied to clipboard' : `Copy ${NPX_COMMAND} to clipboard`}
      aria-live="polite"
      className={cn(
        'group inline-flex max-w-full items-center gap-3 border border-border-strong bg-surface font-mono text-fg transition-colors duration-150 ease-standard hover:border-fg active:translate-y-px',
        size === 'lg'
          ? 'min-h-12 py-2.5 pl-4 pr-3 text-[0.8125rem] sm:text-[0.9375rem]'
          : 'min-h-11 py-2 pl-3.5 pr-2.5 text-[0.8125rem] sm:text-sm',
        className,
      )}
    >
      <span className="text-fg-subtle" aria-hidden>
        $
      </span>
      <span className="min-w-0 flex-1 text-left leading-snug [overflow-wrap:anywhere] sm:truncate">
        {NPX_COMMAND}
      </span>
      <span
        className={cn(
          'ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center border border-transparent transition-colors duration-150',
          copied ? 'bg-accent text-accent-fg' : 'text-fg-muted group-hover:text-fg',
        )}
        aria-hidden
      >
        {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
      </span>
      <span className="sr-only">
        {copied ? 'Copied' : failed ? 'Copy failed, select the text instead' : ''}
      </span>
    </button>
  )
}
