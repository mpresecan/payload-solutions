import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import type { AccentId } from '@payload-solutions/brand'
import { OG_SIZE, OgCard, jpegDataUrl, type OgCardProps } from '@payload-solutions/brand/og-card'

export {
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgConfigPanel,
  clampOgText,
} from '@payload-solutions/brand/og-card'

/**
 * This site's side of the shared OgCard (packages/brand/src/og-card.tsx): the fonts and the
 * backdrops, read as siblings of this file so Next traces them into the deployment. Not a
 * route; the site-wide card is ./opengraph-image.tsx and the docs cards are ./docs-og.
 *
 * The backdrops are baked from the hero poster by packages/brand/scripts/og-backdrops.mjs:
 * `backdrop.jpg` is the poster itself, the rest are one duotone per entity for the docs. Each
 * URL is a literal, not a template, so the file tracer can see every one of them.
 */
const BACKDROPS: Record<'site' | AccentId, URL> = {
  site: new URL('./og-assets/backdrop.jpg', import.meta.url),
  solutions: new URL('./og-assets/backdrop-solutions.jpg', import.meta.url),
  stack: new URL('./og-assets/backdrop-stack.jpg', import.meta.url),
  clock: new URL('./og-assets/backdrop-clock.jpg', import.meta.url),
  consent: new URL('./og-assets/backdrop-consent.jpg', import.meta.url),
  emails: new URL('./og-assets/backdrop-emails.jpg', import.meta.url),
  scheduler: new URL('./og-assets/backdrop-scheduler.jpg', import.meta.url),
  vercel: new URL('./og-assets/backdrop-vercel.jpg', import.meta.url),
}

/** Geist is SIL OFL licensed; the three faces used here are vendored next to this file. */
async function loadFonts() {
  const [sansMedium, sansRegular, mono] = await Promise.all([
    readFile(new URL('./og-fonts/Geist-Medium.ttf', import.meta.url)),
    readFile(new URL('./og-fonts/Geist-Regular.ttf', import.meta.url)),
    readFile(new URL('./og-fonts/GeistMono-Regular.ttf', import.meta.url)),
  ])
  return [
    { name: 'Geist', data: sansRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Geist', data: sansMedium, weight: 500 as const, style: 'normal' as const },
    { name: 'Geist Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ]
}

export type SiteOgCardProps = Omit<OgCardProps, 'site' | 'backdrop'> & {
  /** `site` is the hero poster as it plays; an accent picks that entity's duotone. */
  backdrop?: 'site' | AccentId
}

export async function renderOgCard({ backdrop = 'site', ...props }: SiteOgCardProps) {
  const [fonts, image] = await Promise.all([loadFonts(), readFile(BACKDROPS[backdrop])])
  return new ImageResponse(<OgCard site="solutions" backdrop={jpegDataUrl(image)} {...props} />, {
    ...OG_SIZE,
    fonts,
  })
}
