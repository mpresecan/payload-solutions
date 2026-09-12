import { cn } from '@/lib/cn'

/*
  The architecture, drawn: one tick a minute, one batch, many deployments.

  This is the old site's AnimatedBeam section, kept in substance and rebuilt in form. The
  original measured DOM nodes with refs on the client to place its gradients; the geometry
  here is fixed, so the paths and their lengths are constants computed once at module scope
  and the whole thing is a server component with no JavaScript at all. The travelling light
  is a single dash walking each path (see `.beam-flow` in globals.css).

  Why it is worth a picture: the thing that makes Payload Clock free is that the hand moves
  once a minute for everybody and the work of that minute goes out as ONE batch — Google bills
  per task, not per ping. Written down that takes a paragraph. Drawn, it takes one look.
*/

const W = 420
const HUB_Y = 196
const ROW_Y = 424
const TARGETS = [56, 177, 298, 386]

/** Quadratic bezier, sampled. Cheap, exact enough for a dash length, and runs once. */
function curveLength(
  [x0, y0]: [number, number],
  [cx, cy]: [number, number],
  [x1, y1]: [number, number],
): number {
  let len = 0
  let px = x0
  let py = y0
  for (let i = 1; i <= 24; i++) {
    const t = i / 24
    const u = 1 - t
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1
    len += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  return len
}

const FANS = TARGETS.map((x, i) => {
  const from: [number, number] = [W / 2, HUB_Y + 34]
  const ctrl: [number, number] = [W / 2 + (x - W / 2) * 0.25, HUB_Y + 150]
  const to: [number, number] = [x, ROW_Y - 26]
  return {
    x,
    d: `M ${from[0]} ${from[1]} Q ${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`,
    len: Math.round(curveLength(from, ctrl, to)),
    // Staggered so the batch reads as four things leaving together, not as a drum roll.
    delay: (i * 0.11).toFixed(2),
  }
})

const TICK_LEN = HUB_Y - 34 - 96

function Node({
  x,
  y,
  w,
  h,
  label,
  sub,
  strong,
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  strong?: boolean
}) {
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        fill="var(--bg)"
        stroke={strong ? 'var(--accent-line)' : 'var(--border-strong)'}
        strokeWidth="1"
      />
      <text
        x={x}
        y={sub ? y - 3 : y + 5}
        textAnchor="middle"
        fill={strong ? 'var(--accent)' : 'var(--fg)'}
        fontSize="15"
        fontFamily="var(--font-sans)"
        letterSpacing="-0.02em"
      >
        {label}
      </text>
      {sub ? (
        <text
          x={x}
          y={y + 16}
          textAnchor="middle"
          fill="var(--fg-subtle)"
          fontSize="12"
          fontFamily="var(--font-mono)"
        >
          {sub}
        </text>
      ) : null}
    </g>
  )
}

export function PingBeams({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} 470`}
      className={cn('h-auto w-full', className)}
      fill="none"
      role="img"
      aria-label="One scheduler tick a minute reaches Payload Clock, which sends a single batch out to every Payload deployment due in that minute."
    >
      {/* The tick, top. Cloud Scheduler's free tier is three jobs; Payload Clock uses one,
          for everybody. */}
      <Node x={W / 2} y={72} w={252} h={48} label="One tick" sub="* * * * *" />

      <line
        x1={W / 2}
        y1={96}
        x2={W / 2}
        y2={HUB_Y - 34}
        stroke="var(--border)"
        strokeWidth="1"
      />
      <line
        className="beam-flow"
        x1={W / 2}
        y1={96}
        x2={W / 2}
        y2={HUB_Y - 34}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ '--beam-len': TICK_LEN, '--beam-duration': '3.4s' } as React.CSSProperties}
      />

      <Node x={W / 2} y={HUB_Y} w={252} h={68} label="Payload Clock" sub="one batch" strong />

      {/* The fan. Guide first, light over it. */}
      {FANS.map((f) => (
        <path key={`g-${f.x}`} d={f.d} stroke="var(--border)" strokeWidth="1" />
      ))}
      {FANS.map((f) => (
        <path
          key={`b-${f.x}`}
          className="beam-flow"
          d={f.d}
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={
            {
              '--beam-len': f.len,
              '--beam-delay': `${f.delay}s`,
              '--beam-duration': '3.4s',
            } as React.CSSProperties
          }
        />
      ))}

      {/* The deployments. The fourth is an ellipsis: there is no number here, which is the
          point — the batch costs the same whether it carries one project or fifty. */}
      {TARGETS.map((x, i) => (
        <g key={x}>
          <rect
            x={x - 44}
            y={ROW_Y - 26}
            width={88}
            height={52}
            fill="var(--bg)"
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
          {i === TARGETS.length - 1 ? (
            <text
              x={x}
              y={ROW_Y + 6}
              textAnchor="middle"
              fill="var(--fg-subtle)"
              fontSize="18"
              fontFamily="var(--font-mono)"
            >
              &#8230;
            </text>
          ) : (
            <>
              <text
                x={x}
                y={ROW_Y - 4}
                textAnchor="middle"
                fill="var(--fg)"
                fontSize="13"
                fontFamily="var(--font-sans)"
              >
                your app
              </text>
              <text
                x={x}
                y={ROW_Y + 13}
                textAnchor="middle"
                fill="var(--fg-subtle)"
                fontSize="10.5"
                fontFamily="var(--font-mono)"
              >
                /jobs/run
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}
