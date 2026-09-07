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

export interface SlideFacesProps {
  children: ReactNode
  /** Secondary text on the right, before the icon (a command, a duration, a count). */
  meta?: ReactNode
  /** Replaces the diagonal arrow — a copy glyph, a check, nothing. */
  icon?: ReactNode
}

/**
 * The two stacked faces every slide button is made of: the resting one and the inverted one
 * that rises on hover. The second is aria-hidden, so the label is announced once.
 *
 * Put these inside an element carrying the `slide-btn` class; see the CSS in tailwind.css
 * for the timing, which is lifted from payloadcms.com.
 */
export function SlideFaces({ children, meta, icon }: SlideFacesProps) {
  const face = (hover: boolean) => (
    <span
      className={hover ? 'slide-btn__face slide-btn__face--hover' : 'slide-btn__face'}
      aria-hidden={hover ? true : undefined}
    >
      <span className="slide-btn__text">{children}</span>
      {meta ? <span className="slide-btn__meta">{meta}</span> : null}
      {icon === undefined ? <ArrowGlyph className="slide-btn__arrow" /> : icon}
    </span>
  )
  return (
    <>
      {face(false)}
      {face(true)}
    </>
  )
}

export interface ActionRowProps extends SlideFacesProps {
  href: string
  external?: boolean
  className?: string
}

/**
 * A call to action drawn as a row of the lattice rather than as a filled button: label left,
 * arrow right, one hairline underneath, and the inverted panel on hover. Sized to span whole
 * grid columns — put a stack of them in a `col-span-2` cell and they land exactly on the
 * centre line, which is how payloadcms.com sits its hero actions on the grid.
 */
export function ActionRow({ href, children, meta, icon, external, className }: ActionRowProps) {
  const isExternal = external ?? /^https?:\/\//.test(href)
  return (
    <a
      href={href}
      className={`slide-btn w-full ${className ?? ''}`}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      <SlideFaces meta={meta} icon={icon}>
        {children}
      </SlideFaces>
    </a>
  )
}

export interface ProseLinkProps {
  href: string
  children: ReactNode
  /** Overrides the http(s) sniff on `href`. */
  external?: boolean
  className?: string
}

/**
 * An inline link inside a headline or a paragraph — the one used wherever "Payload CMS" is
 * named in prose on either site. It rests as a hairline under the words and, on hover, an
 * accent line wipes in from the left while the text takes the accent; see `prose-link` in
 * css/tailwind.css. Colour is inherited, so it reads as text first and as a link second,
 * which is what keeps a headline from turning into a row of blue.
 */
export function ProseLink({ href, children, external, className }: ProseLinkProps) {
  const isExternal = external ?? /^https?:\/\//.test(href)
  return (
    <a
      href={href}
      className={`prose-link ${className ?? ''}`}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {children}
    </a>
  )
}

export interface CellGridProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType
}

/**
 * A list on the page grid. Set the column count with a Tailwind grid-cols-* class, matching
 * the background lattice (4, or 2 for full-width halves); children get `list-cell` and no
 * background, so the vertical rules are the lattice showing through.
 */
export function CellGrid({ as: Tag = 'div', className, children, ...rest }: CellGridProps) {
  return (
    <Tag className={`list-grid ${className ?? ''}`} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * The independence line both heroes carry. The mark, the wordmarks and the palette all
 * borrow Payload's visual language closely enough that a visitor could read these sites as
 * official, so they have to say plainly whose they are — in the smallest voice on the page,
 * once, and in identical words on both sites.
 *
 * Deliberately not an Eyebrow: this is a footnote, not a label, and it must not compete
 * with the headline it sits under.
 */
export function IndependenceNote({ className }: { className?: string }) {
  return (
    <p
      className={`flex max-w-[34rem] items-start gap-3 text-[0.8125rem] leading-[1.5] text-fg-subtle ${className ?? ''}`}
    >
      <span aria-hidden className="mt-[0.6em] h-px w-4 shrink-0 bg-border-strong" />
      <span>
        An independent project built for the Payload community — not affiliated with or endorsed by
        Payload CMS.
      </span>
    </p>
  )
}
