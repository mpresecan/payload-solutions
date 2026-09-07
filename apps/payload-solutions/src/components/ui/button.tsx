import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

const base =
  'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap px-4 text-[0.9375rem] font-medium leading-none transition-colors duration-150 ease-standard select-none disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-transparent text-fg hover:border-accent hover:text-accent',
  ghost: 'text-fg-muted hover:text-fg',
}

const sizes: Record<Size, string> = {
  md: 'h-11 px-4',
  lg: 'h-12 px-5 text-base',
}

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant
  size?: Size
  href?: string
  external?: boolean
  /** Show the diagonal arrow used for outbound links. */
  arrow?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  external,
  arrow,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], 'btn-slide', className)
  const content = (
    <>
      <span className="btn-slide__label">
        {children}
        {arrow ? <ArrowUpRight size={16} weight="bold" aria-hidden /> : null}
      </span>
      <span className="btn-slide__ghost" aria-hidden>
        {children}
        {arrow ? <ArrowUpRight size={16} weight="bold" aria-hidden /> : null}
      </span>
    </>
  )

  if (href) {
    const isExternal = external ?? /^https?:\/\//.test(href)
    if (isExternal) {
      return (
        <a href={href} className={classes} target="_blank" rel="noreferrer noopener">
          {content}
        </a>
      )
    }
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  )
}
