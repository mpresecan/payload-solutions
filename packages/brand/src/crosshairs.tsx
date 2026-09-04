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
  const half = size / 2
  return (
    <>
      {corners.map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`pointer-events-none absolute ${pos} ${className ?? ''}`}
          style={{ width: 0, height: 0 }}
        >
          <span
            className="absolute"
            style={{
              left: -half,
              top: -0.5,
              width: size,
              height: 1,
              backgroundColor: 'var(--border-strong)',
            }}
          />
          <span
            className="absolute"
            style={{
              left: -0.5,
              top: -half,
              width: 1,
              height: size,
              backgroundColor: 'var(--border-strong)',
            }}
          />
        </span>
      ))}
    </>
  )
}
