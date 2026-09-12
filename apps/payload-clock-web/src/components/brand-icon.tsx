import type { SimpleIcon } from 'simple-icons'

interface BrandIconProps {
  icon: SimpleIcon
  size?: number
  className?: string
  /** Render the vendor's brand color instead of currentColor. */
  colored?: boolean
}

/** A Simple Icons glyph rendered inline so it inherits the page's text color in both themes. */
export function BrandIcon({ icon, size = 28, className, colored = false }: BrandIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={colored ? `#${icon.hex}` : 'currentColor'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}
