/*
  Payload Clock's signature visual, and its counterpart to Payload Stack's IsoStack. It lives
  in the brand package because two sites draw it: payloadclock.com's hero, and the Payload
  Clock cell on payload.solutions, where Payload Stack shows a screenshot and Clock — which
  has no UI to screenshot yet — shows this instead.

  What it draws is the product, literally: a minute dial with a hand sweeping it once a
  minute, deployments sitting out on the rim, and a pulse of accent light leaving the hub for
  each deployment at the moment the hand passes it. That is Payload Clock in one picture —
  one clock, many projects, a ping when your turn comes round.

  It is also the old site's animated beams, kept and redrawn. The MagicUI version had the same
  idea (light travelling along a line from a hub to a ring of Payload instances) wearing
  rounded cards, drop shadows and a two-colour gradient, none of which survive contact with
  the premium-black system. Here the same motion is hairlines on black, one accent, no boxes.

  Everything is CSS on transform and opacity, keyed off ONE 60-second cycle and a negative
  delay per spoke, so:

    - it is a server component — no hooks, no hydration, no JS shipped for it at all;
    - the pulses cannot drift out of step with the hand, because they are the same clock;
    - `prefers-reduced-motion` kills every animation from one rule in the inlined stylesheet
      below and leaves a legible static diagram behind.

  The delay maths: the hand starts at twelve o'clock and takes 60s for 360°, so it reaches a
  spoke at `angle / 6` seconds. Subtracting a whole cycle makes that delay negative, which
  starts each spoke mid-cycle on first paint instead of waiting up to a minute for the first
  pulse.
*/

/** Where the deployments sit, in degrees clockwise from twelve o'clock. */
const SPOKES = [22, 58, 104, 143, 187, 231, 276, 318]

const CENTER = 220
const RING = 148
const SPOKE_END = 196
const TRAVEL = 1.3 // seconds for a pulse to cross from hub to rim

/** Point on a circle of radius `r` at `deg` clockwise from twelve o'clock. */
function polar(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)]
}

export function ClockDial({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 440"
      className={['clock-dial h-auto w-full', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="A clock dial with a hand sweeping once a minute, sending a pulse to each connected Payload deployment as it passes."
      fill="none"
    >
      {/* The lit hub. Drawn first so every line and pulse sits over it. */}
      <defs>
        <style>{`
          /* The whole diagram runs off one 60-second cycle, so transform-box has to be explicit:
             the transform origins are written in viewBox units, not in each element's own bounding box. */
          .clock-dial__hand,
          .clock-dial__pulse,
          .clock-dial [style*='rotate'] {
            transform-box: view-box;
          }

          .clock-dial__hand {
            animation: clock-sweep 60s linear infinite;
          }

          @keyframes clock-sweep {
            to {
              transform: rotate(360deg);
            }
          }

          /* Out from the hub to the rim in 1.3s — 2.167% of the 60s cycle — then parked, invisible,
             until its turn comes round again. */
          .clock-dial__pulse {
            opacity: 0;
            animation: clock-pulse 60s linear infinite;
          }

          @keyframes clock-pulse {
            0% {
              transform: translateY(-12px);
              opacity: 0;
            }
            0.25% {
              opacity: 1;
            }
            2.167% {
              transform: translateY(-190px);
              opacity: 0;
            }
            100% {
              transform: translateY(-190px);
              opacity: 0;
            }
          }

          /* The node lights as the pulse lands, then cools over two and a half seconds. Its delay is
             the spoke's delay plus the travel time, so 0% here is the moment of arrival. */
          .clock-dial__node {
            animation: clock-blip 60s linear infinite;
          }

          @keyframes clock-blip {
            0%,
            100% {
              stroke: var(--border-strong);
              fill: var(--bg);
            }
            0.5% {
              stroke: var(--accent);
              fill: var(--accent-soft);
            }
            4.5% {
              stroke: var(--border-strong);
              fill: var(--bg);
            }
          }

          /* One rule retires the whole diagram for anyone who asks for less motion. What is left is
             not a broken picture: the hand parks at twelve, the nodes keep their hairline. */
          @media (prefers-reduced-motion: reduce) {
            .clock-dial__hand,
            .clock-dial__pulse,
            .clock-dial__node {
              animation: none;
            }
          }
        `}</style>
        <radialGradient id="clock-hub-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
          <stop offset="42%" stopColor="var(--accent)" stopOpacity="0.045" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        {/* The hand: bright at the tip, gone by the hub, so it reads as a sweep rather than
            as a spoke of its own. */}
        <linearGradient
          id="clock-hand"
          gradientUnits="userSpaceOnUse"
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - RING}
        >
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={RING + 18} fill="url(#clock-hub-glow)" />

      {/* Two hairline rings and the minute ticks: the dial as a measuring instrument, in the
          same weight as the page's background lattice. */}
      <circle cx={CENTER} cy={CENTER} r={RING} stroke="var(--border-strong)" strokeWidth="1" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RING - 34}
        stroke="var(--border)"
        strokeWidth="1"
        strokeDasharray="2 6"
      />

      <g stroke="var(--border-strong)" strokeWidth="1">
        {Array.from({ length: 60 }, (_, i) => {
          const deg = i * 6
          const major = i % 5 === 0
          const [x1, y1] = polar(deg, RING)
          const [x2, y2] = polar(deg, RING + (major ? 13 : 6))
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} opacity={major ? 0.9 : 0.35} />
        })}
      </g>

      {/* One group per deployment: the guide line, the node on the rim, and the pulse that
          travels out to it. The group is rotated to the spoke's angle, so the pulse only ever
          has to move along its own Y axis. */}
      {SPOKES.map((deg) => {
        const [nx, ny] = polar(deg, SPOKE_END)
        const [gx, gy] = polar(deg, RING + 16)
        // Negative delay: start the spoke mid-cycle rather than after up to a full minute.
        const delay = `${(deg / 6 - 60).toFixed(2)}s`
        return (
          <g key={deg}>
            <line x1={gx} y1={gy} x2={nx} y2={ny} stroke="var(--border)" strokeWidth="1" />

            {/* The node lights as the pulse lands: the same delay plus the travel time. */}
            <circle
              className="clock-dial__node"
              cx={nx}
              cy={ny}
              r="5.5"
              fill="var(--bg)"
              stroke="var(--border-strong)"
              strokeWidth="1"
              style={{ animationDelay: `${(deg / 6 - 60 + TRAVEL).toFixed(2)}s` }}
            />

            <g
              style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${CENTER}px ${CENTER}px` }}
            >
              <circle
                className="clock-dial__pulse"
                cx={CENTER}
                cy={CENTER}
                r="3"
                fill="var(--accent)"
                style={{ animationDelay: delay }}
              />
            </g>
          </g>
        )
      })}

      {/* The hand. One rotation a minute, linear, forever — the whole diagram is timed off it. */}
      <g className="clock-dial__hand" style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - RING + 4}
          stroke="url(#clock-hand)"
          strokeWidth="1.5"
        />
        <circle cx={CENTER} cy={CENTER - RING + 4} r="3" fill="var(--accent)" />
      </g>

      <circle cx={CENTER} cy={CENTER} r="4.5" fill="var(--accent)" />
      <circle cx={CENTER} cy={CENTER} r="11" stroke="var(--accent-line)" strokeWidth="1" />
    </svg>
  )
}
