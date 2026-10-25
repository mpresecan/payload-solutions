/**
 * The layout grid made visible: five hairlines drawn at the content edges, the centre and
 * the quarters, dividing the page into four equal columns. This is payloadcms.com's
 * background grid, and everything on both sites aligns to it — headlines start on a line,
 * two-column sections split on the centre line, and a call-to-action row is exactly one or
 * two columns wide.
 *
 * The responsive ramp: the two edges are always drawn, the centre line appears from `md`,
 * and the quarter lines from `lg`, so a phone gets a frame rather than a cage.
 *
 * The quarter lines are drawn at half strength. The site's structure is still the edges and
 * the centre — the two-column split every section uses — and giving the quarters equal
 * weight flattens that into an undifferentiated four-up cage. At half opacity they read as
 * what they are: a finer subdivision available when a section wants it.
 *
 * Render once, as the first child of a wrapper that creates a stacking context (`relative
 * isolate`, or `relative z-10`). The lines carry a negative z-index, so they paint above the
 * wrapper's background and below everything in flow: panels cover them, text never crosses
 * them. Server component, no JS.
 *
 * `fadeTop` is for the opening band of a page, the one pulled under the header with
 * `-mt-header pt-header`. payloadcms.com does not run its hero lines up into the header at
 * full strength: they are invisible at the header's bottom border and come up to full
 * strength over the first stretch of the hero, so the header's own hairline is the only
 * hard line at the top of the page and the grid rises out of the black beneath it. The fade
 * is a mask on the whole lattice (not a gradient per line), so all five lines fade on exactly
 * the same curve, and it is eased rather than linear — a straight ramp shows where it starts.
 *
 * `fadeBottom` is the same curve mirrored, for the footer: the lines leave the footer's top
 * hairline at full strength and dissolve over the last 24rem of the page, behind the
 * oversized wordmark, so the grid ends in black instead of being cut off by the bottom of
 * the window. Both props can be combined; they are drawn as one mask.
 */
export function GridColumns({
  className,
  fadeTop = false,
  fadeBottom = false,
}: {
  className?: string
  fadeTop?: boolean
  fadeBottom?: boolean
}) {
  const mask = fadeTop || fadeBottom ? fadeMask({ fadeTop, fadeBottom }) : undefined
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-[-1] ${className ?? ''}`}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <div className="container-content relative h-full">
        {[0, 1, 2, 3, 4].map((i) => {
          const edge = i === 0 || i === 4
          const centre = i === 2
          return (
            <span
              key={i}
              className={`absolute inset-y-0 w-px ${edge ? '' : centre ? 'hidden md:block' : 'hidden lg:block'}`}
              style={{
                left: `calc(var(--gutter) + (100% - 2 * var(--gutter)) * ${i / 4})`,
                // Pull the closing line back inside the container, so it sits ON the content
                // edge instead of one pixel past it (payloadcms.com does the same).
                marginLeft: i === 4 ? '-1px' : undefined,
                backgroundColor: 'var(--border)',
                opacity: edge || centre ? 1 : 0.45,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// Measured off payloadcms.com's hero at 1440: nothing at the header's bottom edge, a faint
// trace ~6rem below it, full strength by ~24rem. The intermediate stops approximate an
// ease-in so the lines do not appear to switch on at a visible point. The bottom fade is
// the same ramp mirrored against the element's bottom edge.
const FADE_RAMP: ReadonlyArray<[alpha: string, offset: string]> = [
  ['transparent', '0rem'],
  ['rgba(0, 0, 0, 0.12)', '6rem'],
  ['rgba(0, 0, 0, 0.4)', '12rem'],
  ['rgba(0, 0, 0, 0.75)', '18rem'],
  ['#000', '24rem'],
]

function fadeMask({ fadeTop, fadeBottom }: { fadeTop: boolean; fadeBottom: boolean }) {
  const top = fadeTop
    ? FADE_RAMP.map(([alpha, offset]) => `${alpha} calc(var(--header-height) + ${offset})`)
    : ['#000 0%']
  const bottom = fadeBottom
    ? [...FADE_RAMP].reverse().map(([alpha, offset]) => `${alpha} calc(100% - ${offset})`)
    : ['#000 100%']
  return `linear-gradient(to bottom, ${[...top, ...bottom].join(', ')})`
}
