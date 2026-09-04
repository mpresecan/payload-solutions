import Link from 'next/link'

import { cn } from '@/lib/utils'
import stack from '@/stack.config'

/**
 * Your logo. Replace the mark below with your own SVG; the wordmark reads stack.name.
 */
export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold"
      >
        {stack.name.charAt(0)}
      </span>
      <span>{stack.name}</span>
    </Link>
  )
}
