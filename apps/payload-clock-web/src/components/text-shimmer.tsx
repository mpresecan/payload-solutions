import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The line above the headline, carried over from the old site's MagicUI badge.
 *
 * What is kept is the shimmer travelling through the words. What is dropped is the pill it
 * used to sit in: a rounded translucent chip with a border is the one shape this design
 * system does not have, and on true black it reads as a button that does nothing. Here the
 * light runs through plain text preceded by the same hairline dash every Eyebrow uses, so it
 * sits in the page's own grammar and still catches the eye.
 */
export function ShimmerNote({
  href,
  children,
  className,
}: {
  href?: string
  children: ReactNode
  className?: string
}) {
  const inner = (
    <>
      <span aria-hidden className="h-px w-7 shrink-0 bg-border-strong" />
      <span className="text-shimmer label-mono">{children}</span>
    </>
  )

  if (!href) {
    return <p className={cn('flex items-center gap-3', className)}>{inner}</p>
  }

  return (
    <a
      href={href}
      {...(/^https?:\/\//.test(href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className={cn(
        'group inline-flex items-center gap-3 transition-opacity hover:opacity-80',
        className,
      )}
    >
      {inner}
    </a>
  )
}
