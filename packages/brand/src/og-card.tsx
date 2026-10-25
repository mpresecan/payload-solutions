import type { ReactElement, ReactNode } from 'react'
import {
  ACCENT_COLORS,
  MARK_BASE_PATH,
  MARK_FACET_COLORS,
  MARK_LID_PATH,
  type AccentId,
  type BrandId,
  brands,
} from './brands'

/**
 * The one Open Graph card behind every share image on all three sites: the hero as a still.
 * The hero film's poster frame is the backdrop (baked by scripts/og-backdrops.mjs, mirrored so
 * the light sits on the right), a scrim holds the copy column dark, and the four-column grid
 * runs over it as hairlines, exactly as GridColumns runs over the video on the page.
 *
 * Pure JSX, no file reads: each app loads its own fonts and backdrop next to its route (the
 * sibling `new URL('./…', import.meta.url)` read is what Next traces into the deployment) and
 * passes the backdrop in as a data URL.
 *
 * SATORI TRAPS, each of which cost a render:
 * - an absolutely positioned layer needs an explicit width/height; `inset: 0` gives a
 *   zero-size box and its background silently disappears;
 * - only `radial-gradient(circle at x y, …)` renders, not the two-value size form;
 * - no WebP, no CSS variables, no `light-dark()`, no filters or blend modes — colours are the
 *   dark-theme literals below and every image treatment is baked into the JPEG;
 * - `maxWidth` is the only reliable way to control where a line breaks.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

/** Dark-theme tokens, inlined. Keep in step with packages/brand/css/tokens.css. */
const FG = '#ffffff'
const FG_MUTED = 'rgba(255, 255, 255, 0.66)'
const FG_SUBTLE = 'rgba(255, 255, 255, 0.5)'
const BORDER = 'rgba(255, 255, 255, 0.125)'
const BORDER_STRONG = 'rgba(255, 255, 255, 0.28)'

/** GridColumns at 1200: the 64px inset, four equal columns, the closing line on the edge. */
const GRID_X = [64, 332, 600, 868, 1135] as const
const [LEFT, , CENTRE, , RIGHT] = GRID_X
const PAD = 64

function Layer({ style }: { style: Record<string, string | number> }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: 'flex',
        ...style,
      }}
    />
  )
}

/** A GridCross: where a horizontal hairline meets one of the grid's vertical lines. */
function Plus({ x, y }: { x: number; y: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 7,
        top: y - 7,
        width: 14,
        height: 14,
        display: 'flex',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 6.5,
          width: 14,
          height: 1,
          background: BORDER_STRONG,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 6.5,
          top: 0,
          width: 1,
          height: 14,
          background: BORDER_STRONG,
        }}
      />
    </div>
  )
}

export function OgMark({ width, fill, lid = fill }: { width: number; fill: string; lid?: string }) {
  return (
    <svg width={width} height={(width * 26) / 20} viewBox="0 0 20 26" fill="none">
      <path d={MARK_BASE_PATH} fill={fill} />
      <path d={MARK_LID_PATH} fill={lid} />
    </svg>
  )
}

export interface OgCardProps {
  /** Whose site this is: the wordmark, and the domain closing the card. */
  site: BrandId
  /** The hero poster (or a docs duotone) as a data URL. Without one the card is plain black. */
  backdrop?: string
  /** Small mono label above the title. */
  eyebrow: string
  title: string
  description?: string
  /** The entity the page is about. Colours the eyebrow rule; defaults to the site. */
  accent?: AccentId
  /**
   * The one thing to do, in a hairline box like the page's action rows: a command, an
   * endpoint. `prompt` is the muted lead ("$", "GET").
   */
  action?: { prompt?: string; text: string }
  /** Mono line bottom-right. Defaults to the site's bare domain. */
  footer?: string
  /** Optional visual for the right half, sitting in the light. */
  aside?: ReactNode
}

export function OgCard({
  site,
  backdrop,
  eyebrow,
  title,
  description,
  accent = site,
  action,
  footer,
  aside,
}: OgCardProps): ReactElement {
  const brand = brands[site]
  const accentColor = ACCENT_COLORS[accent].accent
  const footerText = footer ?? brand.domain
  // Long titles step down rather than wrapping into four lines. With an aside the copy has two
  // columns of room instead of three, so it steps sooner.
  const room = aside ? 0.8 : 1
  const titleSize = title.length <= 26 * room ? 72 : title.length <= 46 * room ? 58 : 48
  const titleWidth = aside ? 560 : 820

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: '#000',
        color: FG,
        fontFamily: 'Geist',
      }}
    >
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM.
        <img
          src={backdrop}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          alt=""
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
      ) : null}

      {/* The copy scrim: near-black over the first two columns, gone by the last. */}
      <Layer
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 30%, rgba(0,0,0,0.6) 52%, rgba(0,0,0,0.18) 76%, rgba(0,0,0,0.05) 100%)',
        }}
      />
      {/* Top and bottom held dark, for the wordmark and the footer line. */}
      <Layer
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 74%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {GRID_X.map((x, i) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            top: 0,
            left: x,
            width: 1,
            height: OG_SIZE.height,
            display: 'flex',
            background: BORDER,
            opacity: i === 1 || i === 3 ? 0.45 : 1,
          }}
        />
      ))}
      {/* The header's bottom rule, crossing the grid, marked where it meets the first line. */}
      <div
        style={{
          position: 'absolute',
          top: 128,
          left: 0,
          width: OG_SIZE.width,
          height: 1,
          display: 'flex',
          background: BORDER,
        }}
      />
      <Plus x={LEFT} y={128} />
      <Plus x={CENTRE} y={128} />

      {aside ? (
        <div
          style={{
            position: 'absolute',
            top: 128,
            left: CENTRE,
            width: RIGHT - CENTRE,
            height: OG_SIZE.height - 128,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {aside}
        </div>
      ) : null}

      {/* Wordmark, centred in the header band above the rule. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: PAD + 32,
          height: 128,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 30,
        }}
      >
        <OgMark width={24} fill={FG} lid={MARK_FACET_COLORS[site]} />
        <span style={{ fontWeight: 400, letterSpacing: '-0.03em' }}>Payload</span>
        <span style={{ fontWeight: 500, letterSpacing: '-0.03em', marginLeft: -6 }}>
          {brand.word}
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 128,
          left: PAD + 32,
          width: (aside ? CENTRE : RIGHT) - PAD - 64,
          height: OG_SIZE.height - 128 - 88,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* `label-mono`, with the rule in the entity's accent: the one mark of whose page this
            is that survives a thumbnail. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', width: 28, height: 2, background: accentColor }} />
          <div
            style={{
              fontFamily: 'Geist Mono',
              fontSize: 20,
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
            lineHeight: 1.02,
            maxWidth: titleWidth,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{ fontSize: 26, color: FG_MUTED, maxWidth: aside ? 470 : 660, lineHeight: 1.42 }}
          >
            {description}
          </div>
        ) : null}
        {action ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 16,
              marginTop: 10,
              padding: '16px 24px',
              border: `1px solid ${BORDER_STRONG}`,
              background: 'rgba(0, 0, 0, 0.55)',
              fontFamily: 'Geist Mono',
              fontSize: 24,
            }}
          >
            {action.prompt ? <span style={{ color: accentColor }}>{action.prompt}</span> : null}
            <span>{action.text}</span>
          </div>
        ) : null}
      </div>

      {/* Footer band: the address of the page being shared. */}
      <div
        style={{
          position: 'absolute',
          left: PAD + 32,
          right: OG_SIZE.width - RIGHT + 32,
          bottom: 0,
          height: 88,
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'Geist Mono',
          fontSize: footerText.length > 34 ? 18 : 21,
          color: FG_SUBTLE,
        }}
      >
        {footerText}
      </div>
    </div>
  )
}

/**
 * payload.config.ts as the umbrella hero types it, every plugin line a feature, each marked in
 * its entity's accent. The still of ConfigHero, for the payload.solutions card.
 */
const CONFIG_LINES: Array<{ fn: string; arg: string; accent?: AccentId }> = [
  { fn: 'betterAuthPlugin', arg: 'auth', accent: 'stack' },
  { fn: 'multiTenantPlugin', arg: 'tenants', accent: 'stack' },
  { fn: 'consentPlugin', arg: 'seed', accent: 'consent' },
  { fn: 'emailsPlugin', arg: 'emails', accent: 'emails' },
  { fn: 'actionScheduler', arg: 'actions', accent: 'scheduler' },
  { fn: 'vercelPlugin', arg: 'targets', accent: 'vercel' },
]

export function OgConfigPanel(): ReactElement {
  const line = { display: 'flex', alignItems: 'center', height: 28 } as const
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 440,
        background: 'rgba(6, 6, 6, 0.82)',
        border: `1px solid ${BORDER_STRONG}`,
        fontFamily: 'Geist Mono',
        fontSize: 18,
        color: FG_MUTED,
        whiteSpace: 'pre',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 38,
          padding: '0 18px',
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 16,
          color: FG_SUBTLE,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 8,
            height: 8,
            borderRadius: 4,
            background: BORDER_STRONG,
          }}
        />
        <div
          style={{
            display: 'flex',
            width: 8,
            height: 8,
            borderRadius: 4,
            background: BORDER_STRONG,
          }}
        />
        <div
          style={{
            display: 'flex',
            width: 8,
            height: 8,
            borderRadius: 4,
            background: BORDER_STRONG,
            marginRight: 8,
          }}
        />
        payload.config.ts
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 18px 12px' }}>
        <div style={line}>
          <span style={{ color: FG }}>buildConfig</span>({'{'}
        </div>
        <div style={{ ...line, paddingLeft: 22 }}>plugins: [</div>
        {CONFIG_LINES.map(({ fn, arg, accent }) => (
          <div key={fn} style={{ ...line, paddingLeft: 44, gap: 0 }}>
            <div
              style={{
                display: 'flex',
                width: 3,
                height: 18,
                marginLeft: -16,
                marginRight: 13,
                background: accent ? ACCENT_COLORS[accent].accent : 'transparent',
              }}
            />
            <span style={{ color: FG }}>{fn}</span>({'{ '}
            <span style={{ color: FG_SUBTLE }}>{arg}</span>
            {' }'}),
          </div>
        ))}
        <div style={{ ...line, paddingLeft: 22 }}>],</div>
        <div style={line}>{'})'}</div>
      </div>
    </div>
  )
}

/** Trim a description to something that sits under the title without running on. */
export function clampOgText(text: string | undefined, max = 140): string | undefined {
  if (!text) return undefined
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.lastIndexOf(' ', max)
  return `${clean.slice(0, cut === -1 ? max : cut)}…`
}

/** Bytes of a JPEG to the data URL Satori takes as an <img> src. */
export function jpegDataUrl(bytes: Uint8Array): string {
  // btoa over binary-string chunks rather than Buffer, so this file needs no Node types.
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:image/jpeg;base64,${btoa(binary)}`
}
