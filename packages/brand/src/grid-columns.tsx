/**
 * The layout grid made visible: hairlines at the content edges and at the column boundaries
 * the sections actually align to (the hero split, the two-column grids). It sits behind the
 * page content, so opaque panels cover it and the lines only show where there is air.
 *
 * Render once, as the first child of a wrapper that creates a stacking context (`relative
 * isolate`, or `relative z-10`). The lines carry a negative z-index, so they paint above the
 * wrapper's background and below everything in flow: panels cover them, text never crosses
 * them. Server component, no JS.
 */
export function GridColumns({ columns = 2, className }: { columns?: 2 | 4; className?: string }) {
  const lines = Array.from({ length: columns + 1 }, (_, i) => i)
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 z-[-1] ${className ?? ''}`}>
      <div className="container-content relative h-full">
        {lines.map((i) => {
          const edge = i === 0 || i === columns
          const mid = columns === 4 && i % 2 === 1
          return (
            <span
              key={i}
              className={`absolute inset-y-0 w-px ${edge ? '' : mid ? 'hidden lg:block' : 'hidden md:block'}`}
              style={{
                left: `calc(var(--gutter) + (100% - 2 * var(--gutter)) * ${i / columns})`,
                backgroundColor: 'var(--border)',
                opacity: edge ? 1 : 0.7,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
