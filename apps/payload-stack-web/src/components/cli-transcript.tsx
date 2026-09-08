/**
 * The create-payload-stack terminal transcript, rendered as real text rather than a
 * screenshot so it stays legible on a phone, selectable, and themed by the band it sits in.
 *
 * Two cuts of ONE source of truth. `full` is the whole prompt flow, for the home page's
 * "One command" section. `decisions` keeps only the three prompts the fit page argues about
 * — database, organizations, billing — and collapses the rest into a single dim line, so the
 * two pages can never claim different flows.
 *
 * This mirrors the real CLI. Keep it in sync when the prompts change.
 */

type Line =
  | { t: 'blank' }
  /** The invocation. */
  | { t: 'cmd'; v: string }
  /** Clack frame and rail characters. */
  | { t: 'ui'; v: string }
  /** A prompt and the answer given. `v` is null for a step with no answer to show. */
  | { t: 'q'; k: string; v: string | null }
  /** Steps left out of a condensed cut, named so the omission is visible. */
  | { t: 'dim'; v: string }
  /** A next-step command printed after the run. */
  | { t: 'next'; v: string }

const RUN: Line = { t: 'cmd', v: '$ npx create-payload-stack@latest' }
const RAIL: Line = { t: 'ui', v: '│' }

const Q = {
  name: { t: 'q', k: '◇  Project name', v: '│  ridgeline' },
  database: { t: 'q', k: '◇  Database', v: '│  PostgreSQL' },
  connection: {
    t: 'q',
    k: '◇  Connection string',
    v: '│  postgres://postgres:<password>@127.0.0.1:5432/ridgeline',
  },
  signIn: { t: 'q', k: '◇  Sign-in methods', v: '│  Email + password, Magic link, Passkeys' },
  organizations: { t: 'q', k: '◇  Organizations (teams)', v: '│  Yes' },
  billing: { t: 'q', k: '◇  Billing', v: '│  Stripe subscriptions, per organization' },
  storage: { t: 'q', k: '◇  Media storage', v: '│  Vercel Blob' },
  install: { t: 'q', k: '◇  Installed dependencies with pnpm', v: null },
} satisfies Record<string, Line>

const FULL: Line[] = [
  RUN,
  { t: 'blank' },
  { t: 'ui', v: '┌  create-payload-stack' },
  RAIL,
  Q.name,
  RAIL,
  Q.database,
  RAIL,
  Q.connection,
  RAIL,
  Q.signIn,
  RAIL,
  Q.organizations,
  RAIL,
  Q.billing,
  RAIL,
  Q.storage,
  RAIL,
  Q.install,
  RAIL,
  { t: 'ui', v: '└  Done. Next steps:' },
  { t: 'blank' },
  { t: 'next', v: '   cd ridgeline' },
  { t: 'next', v: '   pnpm dev' },
  { t: 'next', v: '   open http://localhost:3000/admin' },
]

const DECISIONS: Line[] = [
  RUN,
  { t: 'blank' },
  { t: 'ui', v: '┌  create-payload-stack' },
  RAIL,
  Q.database,
  RAIL,
  Q.organizations,
  RAIL,
  Q.billing,
  RAIL,
  { t: 'dim', v: '│  … project name, sign-in, media storage' },
  RAIL,
  { t: 'ui', v: '└  Done. Next steps:' },
  { t: 'blank' },
  { t: 'next', v: '   cd ridgeline' },
  { t: 'next', v: '   pnpm dev' },
]

const TRANSCRIPTS = { full: FULL, decisions: DECISIONS }

function renderLine(line: Line, i: number) {
  switch (line.t) {
    case 'blank':
      return <span key={i}>{'\n'}</span>
    case 'cmd':
      return (
        <span key={i}>
          <span className="tok-c">$ </span>
          <span className="tok-s">{line.v.slice(2)}</span>
          {'\n'}
        </span>
      )
    case 'q':
      return (
        <span key={i}>
          <span className="tok-p">{line.k}</span>
          {'\n'}
          {line.v ? (
            <>
              {/* The rail character stays dim; only the answer takes the accent. */}
              <span className="tok-c">{line.v.slice(0, 3)}</span>
              <span className="tok-k">{line.v.slice(3)}</span>
              {'\n'}
            </>
          ) : null}
        </span>
      )
    case 'next':
      return (
        <span key={i}>
          <span className="tok-s">{line.v}</span>
          {'\n'}
        </span>
      )
    default:
      return (
        <span key={i} className="tok-c">
          {line.v}
          {'\n'}
        </span>
      )
  }
}

export function CliTranscript({
  variant = 'full',
  className,
}: {
  variant?: keyof typeof TRANSCRIPTS
  className?: string
}) {
  return (
    <pre
      className={`code-block border border-border bg-surface p-5 text-[0.75rem] sm:p-6 sm:text-[0.8125rem] ${className ?? ''}`}
      aria-label="Terminal transcript of create-payload-stack"
    >
      <code>{TRANSCRIPTS[variant].map(renderLine)}</code>
    </pre>
  )
}
