import type { CSSProperties } from 'react'

type GridLine = 0 | 1 | 2 | 3 | 4

/** One plus: two 1px strokes centred on the origin of a zero-size, absolutely placed box. */
function Plus({ size, className, style }: { size: number; className?: string; style?: CSSProperties }) {
  const half = size / 2
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className ?? ''}`}
      style={{ width: 0, height: 0, ...style }}
    >
      <span
        className="absolute"
        style={{ left: -half, top: -0.5, width: size, height: 1, backgroundColor: 'var(--fg-subtle)' }}
      />
      <span
        className="absolute"
        style={{ left: -0.5, top: -half, width: 1, height: size, backgroundColor: 'var(--fg-subtle)' }}
      />
    </span>
  )
}

/**
 * Corner marks where a panel's hairlines meet the page grid: two 1px lines forming a plus,
 * centred on each corner of the parent. Use on framed media and the hero's visual, not as
 * decoration on every box. The parent must be `relative`.
 */
export function Crosshairs({ size = 14, className }: { size?: number; className?: string }) {
  const corners = [
    '-top-px -left-px',
    '-top-px -right-px',
    '-bottom-px -left-px',
    '-bottom-px -right-px',
  ]
  return (
    <>
      {corners.map((pos) => (
        <Plus key={pos} size={size} className={`${pos} ${className ?? ''}`} />
      ))}
    </>
  )
}

/**
 * A plus where a horizontal hairline crosses one of GridColumns' vertical lines, as
 * payloadcms.com marks a few of its grid intersections. A small touch, so: one or two per
 * rule, never every crossing, and moved to a different line from one section to the next so
 * the marks wander down the page instead of stacking into a column.
 *
 * `line` counts the GridColumns lines left to right (0 and 4 are the content edges, 2 the
 * centre), and the mark follows the same responsive ramp as the line it sits on, so it never
 * floats on a crossing that is not drawn. `edge` picks the parent's top or bottom border.
 *
 * By default the parent is full-bleed (a section with `hairline-t`) and the mark is placed on
 * the page grid. Pass `contained` when the parent already spans exactly the four columns
 * (a `list-grid`, a `col-grid` row). The parent must be `relative`. Server component, no JS.
 */
export function GridCross({
  line,
  edge = 'top',
  contained = false,
  size = 14,
}: {
  line: GridLine
  edge?: 'top' | 'bottom'
  contained?: boolean
  size?: number
}) {
  const visibility = line === 0 || line === 4 ? '' : line === 2 ? 'hidden md:block' : 'hidden lg:block'
  const left = contained
    ? `${(line / 4) * 100}%`
    : `calc(var(--gutter) + (100% - 2 * var(--gutter)) * ${line / 4})`
  // Centred on the border: it sits just outside the padding box the offsets are measured from,
  // and the closing line is pulled back one pixel inside the container, as GridColumns draws it.
  const mark = (
    <Plus
      size={size}
      className={visibility}
      style={{
        left: line === 4 ? `calc(${left} - 0.5px)` : `calc(${left} + 0.5px)`,
        top: edge === 'top' ? -0.5 : undefined,
        bottom: edge === 'bottom' ? -0.5 : undefined,
      }}
    />
  )
  if (contained) return mark
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 ${edge === 'top' ? 'top-0' : 'bottom-0'}`}
    >
      <span className="container-content relative block h-0">{mark}</span>
    </span>
  )
}
