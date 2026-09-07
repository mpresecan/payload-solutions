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
 */
export function GridColumns({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 z-[-1] ${className ?? ''}`}>
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
