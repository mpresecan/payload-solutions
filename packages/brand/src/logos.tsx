import type { CSSProperties, SVGProps } from 'react'
import { brands, type BrandId } from './brands'

/**
 * The shared mark used by all three brands (the mark first shipped with Payload Clock).
 * Fills with `currentColor` so it inherits the surrounding text color in both themes.
 * viewBox 20 x 26.
 */
export function Mark({
  size = 26,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; title?: string }) {
  const width = (20 / 26) * size
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 20 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z"
        fill="currentColor"
      />
      <path d="M11 23.5V15L18 19.5L11 23.5Z" fill="currentColor" />
    </svg>
  )
}

export interface LogoProps {
  brand: BrandId
  /** Height of the mark in px. The wordmark scales with it. */
  size?: number
  className?: string
  style?: CSSProperties
  /** Hide the wordmark and show only the mark. */
  compact?: boolean
}

/**
 * Mark + wordmark. The wordmark is live text (Geist, tight tracking) rather than outlined paths,
 * so it stays crisp, themeable and selectable. "Payload" is regular weight, the brand word is medium.
 */
export function Logo({ brand, size = 26, className, style, compact = false }: LogoProps) {
  const b = brands[brand]
  const fontSize = Math.round(size * 0.78)
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.38),
        lineHeight: 1,
        color: 'inherit',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      aria-label={b.name}
    >
      <Mark size={size} />
      {compact ? null : (
        <span
          style={{
            fontSize,
            letterSpacing: '-0.035em',
            fontWeight: 400,
            display: 'inline-flex',
            gap: '0.28em',
          }}
        >
          <span>Payload</span>
          <span style={{ fontWeight: 600 }}>{b.word}</span>
        </span>
      )}
    </span>
  )
}
