import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import { SlideFaces } from '@payload-solutions/brand/lattice'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

/**
 * Three appearances, mirroring payloadcms.com:
 *
 * - `secondary` is the hairline box, and the only one that gets the slide: an inverted panel
 *   rises from below while the resting label leaves upward and each label pivots three
 *   degrees. It is the site's default call to action.
 * - `primary` is the one accent-filled element a page is allowed. Like payloadcms.com's own
 *   primary, it just changes colour — two competing animations in one row of buttons reads
 *   as fussy.
 * - `ghost` is a text link wearing a button's hit area.
 */
const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-[0.9375rem] font-medium leading-none transition-colors duration-150 ease-standard select-none disabled:pointer-events-none disabled:opacity-50'

const flat: Record<Exclude<Variant, 'secondary'>, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
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
  const slide = variant === 'secondary'
  const classes = slide
    ? cn('slide-btn slide-btn-sm justify-center', className)
    : cn(base, flat[variant], sizes[size], className)

  const arrowGlyph = arrow ? <ArrowUpRight size={16} weight="bold" aria-hidden /> : null
  const content = slide ? (
    <SlideFaces icon={arrowGlyph ?? null}>{children}</SlideFaces>
  ) : (
    <>
      {children}
      {arrowGlyph}
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
