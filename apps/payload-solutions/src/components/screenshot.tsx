import { ImageZoom } from 'fumadocs-ui/components/image-zoom'

type ScreenshotProps = {
  /** What the screenshot shows, for screen readers and when the image fails to load. */
  alt: string
  /** Optional line under the image. */
  caption?: string
  /**
   * Intrinsic size in CSS pixels (the files are 2× this). Full admin screenshots are 1440×900; crops pass
   * their own, and are never shown wider than this.
   */
  height?: number
  /**
   * Path under `public/images/docs/` without the theme suffix, e.g. `payload-emails/editor`.
   * Both `<name>-light.webp` and `<name>-dark.webp` must exist; the one matching the site theme is shown.
   */
  name: string
  width?: number
}

/**
 * An admin screenshot in docs: captured in Payload's light and dark themes and swapped with the site
 * theme, click to zoom. Captured at 2× by the screenshot harness (see notes/docs-screenshots.md).
 */
export function Screenshot({ alt, caption, height = 900, name, width = 1440 }: ScreenshotProps) {
  const image = (theme: 'dark' | 'light') => (
    <ImageZoom
      alt={alt}
      className="m-0 block h-auto w-full"
      height={height}
      loading="lazy"
      sizes="(min-width: 1024px) 860px, 100vw"
      src={`/images/docs/${name}-${theme}.webp`}
      width={width}
    />
  )

  return (
    <figure className="not-prose my-6" style={{ maxWidth: width }}>
      <div className="overflow-hidden border border-border">
        <div className="only-light">{image('light')}</div>
        <div className="only-dark">{image('dark')}</div>
      </div>
      {caption ? <figcaption className="mt-2 text-sm text-fg-muted">{caption}</figcaption> : null}
    </figure>
  )
}
