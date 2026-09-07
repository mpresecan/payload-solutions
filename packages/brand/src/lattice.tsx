import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

/*
  The lattice grammar, shared by payload.solutions and payloadstack.com.

  payloadcms.com organises a page with one continuous hairline grid drawn on black: no
  cards, no filled panels, no shadows. Content sits in cells of that grid, and the only
  chrome is the 1px rule between them. These are the pieces of that language that both
  sites use, so a section headline, an eyebrow and a call-to-action row are identical
  everywhere and only the accent changes.

  All server components; no client JS, no icon dependency (the arrow is inline SVG).
*/

/** The diagonal arrow used on outbound rows and links. Inline so brand stays dependency-free. */
export function ArrowGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden
      className={className}
    >
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
    </svg>
  )
}

/**
 * A small mono label preceded by a short rule. Rationed: at most one per three sections,
 * and never two in the same viewport.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`label-mono flex items-center gap-3 ${className ?? ''}`}>
      <span aria-hidden className="h-px w-7 bg-border-strong" />
      {children}
    </p>
  )
}

export interface SectionHeadProps {
  id?: string
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  /** `lg` is the standard section headline; `md` is for a subordinate block. */
  size?: 'lg' | 'md'
  className?: string
  as?: 'h2' | 'h3'
}

/**
 * The one headline shape used by every section on both sites: optional eyebrow, a tight
 * display heading, an optional lead paragraph, all left-aligned in a measure that keeps the
 * headline to roughly two lines at desktop.
 */
export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
  size = 'lg',
  className,
  as: Tag = 'h2',
}: SectionHeadProps) {
  return (
    <div className={`max-w-[46rem] ${className ?? ''}`}>
      {eyebrow ? <Eyebrow className="mb-7">{eyebrow}</Eyebrow> : null}
      <Tag id={id} className={size === 'lg' ? 'display-lg' : 'display-md'}>
        {title}
      </Tag>
      {lead ? <p className="lead mt-6 max-w-[38rem]">{lead}</p> : null}
    </div>
  )
}

export interface ActionRowProps {
  href: string
  children: ReactNode
  /** Secondary text on the right, before the arrow (a command, a duration, a count). */
  meta?: ReactNode
  external?: boolean
  className?: string
}

/**
 * A full-bleed call to action drawn as a row of the lattice rather than as a button: label
 * left, arrow right, one hairline underneath. This is the shape payloadcms.com uses under
 * its hero, and it is what makes a page read as a document rather than as a landing page.
 */
export function ActionRow({ href, children, meta, external, className }: ActionRowProps) {
  const isExternal = external ?? /^https?:\/\//.test(href)
  return (
    <a
      href={href}
      className={`action-row group ${className ?? ''}`}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="flex shrink-0 items-center gap-4">
        {meta ? <span className="hidden text-sm text-fg-subtle sm:block">{meta}</span> : null}
        <ArrowGlyph className="action-row__arrow" />
      </span>
    </a>
  )
}

export interface CellGridProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType
}

/**
 * The hairline cell grid. Set the column count with a Tailwind grid-cols-* class; the 1px
 * gaps are the rules, so children only need a background (`bg-bg`, or `bg-accent-soft` for
 * the single tinted cell a section is allowed).
 */
export function CellGrid({ as: Tag = 'div', className, children, ...rest }: CellGridProps) {
  return (
    <Tag className={`cell-grid ${className ?? ''}`} {...rest}>
      {children}
    </Tag>
  )
}
