import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import type { ReactElement } from 'react'
import { ACCENT_COLORS, type AccentId, brands } from '@payload-solutions/brand'

const brand = brands.solutions

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

/**
 * Dark-theme tokens, inlined: Satori has no CSS variables, no `light-dark()` and no
 * stylesheet. Keep in step with packages/brand/css/tokens.css; the per-entity accents come
 * from ACCENT_COLORS in the brand package, which is typed so a new entity cannot be added
 * without one.
 */
const BG = '#000000'
const FG = '#ffffff'
const FG_MUTED = 'rgba(255, 255, 255, 0.62)'
const BORDER = 'rgba(255, 255, 255, 0.125)'

/**
 * The four-column grid, at the 64px content inset payloadcms.com uses and both sites copy:
 * edges and centre at full strength, the quarters at 0.45, exactly as GridColumns draws
 * them. The closing line is pulled back a pixel so it sits ON the edge.
 */
const GRID_X = [64, 332, 600, 868, 1136]

function Mark({ width, fill }: { width: number; fill: string }) {
  return (
    <svg width={width} height={(width * 26) / 20} viewBox="0 0 20 26" fill="none">
      <path
        d="M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z"
        fill={fill}
      />
      <path d="M11 23.5V15L18 19.5L11 23.5Z" fill={fill} />
    </svg>
  )
}

export interface OgCardProps {
  /** Small mono label above the title — the docs section, or the site's own line. */
  eyebrow: string
  title: string
  description?: string
  /** Mono line closing the card, bottom left. Defaults to the bare domain. */
  footer?: string
  /** Whose page this is. Drives the glow and the eyebrow rule; defaults to the umbrella. */
  accent?: AccentId
}

/**
 * One card behind every Open Graph image on this site: the hero composition held still —
 * true black, the entity's own light where the mark stands, the mark ghosted behind it, and
 * the four-column grid as hairlines.
 *
 * SATORI: absolutely positioned layers need an explicit width/height. `inset: 0` gives a
 * zero-size box and the gradient silently disappears. Likewise the two-value size form
 * `radial-gradient(58% 82% at x y, …)` does not render — only `circle at x y` does.
 */
export function OgCard({
  eyebrow,
  title,
  description,
  footer,
  accent = 'solutions',
}: OgCardProps): ReactElement {
  const { accent: accentColor, glow } = ACCENT_COLORS[accent]
  // Long titles step down rather than wrapping into four lines.
  const titleSize = title.length <= 26 ? 68 : title.length <= 46 ? 56 : 46
  const footerText = footer ?? brand.domain

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: BG,
        color: FG,
        fontFamily: 'Geist',
      }}
    >
      {/* The hero light, low and to the right, where the mark stands. Two stops of the same
          token colour: one tight and one wide, which is what the live glow's large blur
          radius amounts to once it is flattened into a still. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: 'flex',
          backgroundImage: `radial-gradient(circle at 74% 52%, ${glow} 0%, ${glow} 12%, rgba(0,0,0,0) 52%)`,
        }}
      />
      {/* The sheen crossing it. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: 'flex',
          backgroundImage:
            'linear-gradient(100deg, rgba(0,0,0,0) 44%, rgba(255,255,255,0.06) 62%, rgba(0,0,0,0) 80%)',
        }}
      />

      {GRID_X.map((x, i) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: i === GRID_X.length - 1 ? x - 1 : x,
            width: 1,
            display: 'flex',
            background: BORDER,
            opacity: i === 1 || i === 3 ? 0.45 : 1,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: -34,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Mark width={431} fill="rgba(255, 255, 255, 0.14)" />
      </div>

      {/* Scrim: holds the copy at AA over the mark without dimming it — the hero's own. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: 'flex',
          backgroundImage:
            'linear-gradient(100deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.86) 26%, rgba(0,0,0,0.35) 52%, rgba(0,0,0,0) 72%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 64px 60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30 }}>
          <Mark width={24} fill={FG} />
          <span style={{ fontWeight: 400, letterSpacing: '-0.03em' }}>Payload</span>
          <span style={{ fontWeight: 500, letterSpacing: '-0.03em', marginLeft: -6 }}>
            {brand.word}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Eyebrow, as `label-mono` renders it — but the rule takes the accent, because it
              is the one mark of the entity that survives a thumbnail. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', width: 28, height: 2, background: accentColor }} />
            <div
              style={{
                fontFamily: 'Geist Mono',
                fontSize: 21,
                letterSpacing: '0.18em',
                color: FG_MUTED,
              }}
            >
              {eyebrow.toUpperCase()}
            </div>
          </div>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 500,
              letterSpacing: titleSize >= 64 ? '-0.055em' : '-0.045em',
              lineHeight: 1.0,
              maxWidth: 830,
            }}
          >
            {title}
          </div>
          {description ? (
            <div style={{ fontSize: 27, color: FG_MUTED, maxWidth: 640, lineHeight: 1.45 }}>
              {description}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            fontFamily: 'Geist Mono',
            // Docs paths run long; step down rather than running under the mark.
            fontSize: footerText.length > 30 ? 21 : 25,
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {footerText}
        </div>
      </div>
    </div>
  )
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

export async function renderOgCard(props: OgCardProps) {
  return new ImageResponse(<OgCard {...props} />, { ...OG_SIZE, fonts: await loadFonts() })
}

/** Trim a docs description to something that sits under the title without running on. */
export function clampOgText(text: string | undefined, max = 140): string | undefined {
  if (!text) return undefined
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.lastIndexOf(' ', max)
  return `${clean.slice(0, cut === -1 ? max : cut)}…`
}
