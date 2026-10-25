import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { OG_SIZE, OgCard, jpegDataUrl, type OgCardProps } from '@payload-solutions/brand/og-card'

export { OG_CONTENT_TYPE, OG_SIZE } from '@payload-solutions/brand/og-card'

/**
 * This site's side of the shared OgCard (packages/brand/src/og-card.tsx): the fonts and the
 * hero poster backdrop, read as siblings of this file so Next traces them into the deployment.
 * Not a route. The backdrop is baked by packages/brand/scripts/og-backdrops.mjs; re-run it when
 * the hero film changes.
 */
async function load() {
  // Geist is SIL OFL licensed; the three faces used here are vendored next to this file.
  const [sansMedium, sansRegular, mono, backdrop] = await Promise.all([
    readFile(new URL('./og-fonts/Geist-Medium.ttf', import.meta.url)),
    readFile(new URL('./og-fonts/Geist-Regular.ttf', import.meta.url)),
    readFile(new URL('./og-fonts/GeistMono-Regular.ttf', import.meta.url)),
    readFile(new URL('./og-assets/backdrop.jpg', import.meta.url)),
  ])
  const fonts = [
    { name: 'Geist', data: sansRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Geist', data: sansMedium, weight: 500 as const, style: 'normal' as const },
    { name: 'Geist Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ]
  return { fonts, backdrop: jpegDataUrl(backdrop) }
}

export async function renderOgCard(props: Omit<OgCardProps, 'site' | 'backdrop'>) {
  const { fonts, backdrop } = await load()
  return new ImageResponse(<OgCard site="stack" backdrop={backdrop} {...props} />, {
    ...OG_SIZE,
    fonts,
  })
}
