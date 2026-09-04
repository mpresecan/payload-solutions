import type { ComponentPropsWithoutRef, ElementType } from 'react'

export type BandTheme = 'light' | 'dark'

export interface ThemeBandProps extends ComponentPropsWithoutRef<'section'> {
  theme: BandTheme
  as?: ElementType
}

/**
 * A section that keeps one theme whatever the page is set to. The tokens in tokens.css
 * respond to `data-theme` on any element, so everything inside picks up the band's palette,
 * and `data-band-theme` lets the header follow it (useHeaderTheme).
 *
 * Use it once per page, for the hero: one deliberate switch, not alternating stripes.
 * The band isolates its stacking context, so AmbientBackdrop and GridColumns (negative
 * z-index) sit between its background and its content. If an AmbientBackdrop sits inside the
 * band, wrap everything after the band in `<div className="relative z-10 bg-bg">` so it
 * slides over the pinned backdrop.
 */
export function ThemeBand({
  theme,
  as: Tag = 'section',
  className,
  children,
  style,
  ...rest
}: ThemeBandProps) {
  return (
    <Tag
      data-theme={theme}
      data-band-theme={theme}
      className={`relative isolate bg-bg text-fg ${className ?? ''}`}
      style={{ colorScheme: theme, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
