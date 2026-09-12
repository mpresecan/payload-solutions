import { ACCENT_COLORS, type AccentId } from '@payload-solutions/brand'
import { Crosshairs } from '@payload-solutions/brand/crosshairs'
import { Parallax } from '@payload-solutions/brand/parallax'

/**
 * The whole catalogue as it actually appears in a customer's project: four imports and four
 * lines of `plugins`. It sits opposite the open-source statement because it is the claim's
 * evidence — one npm scope, one repository, installed like anything else — and because a
 * paragraph alone on a dark band is not a composition.
 *
 * From lg the plate runs off the right edge of the page, the way payloadcms.com lets a
 * screenshot leave the grid: the longest import is longer than two columns, and a plate that
 * is visibly cut by the page edge reads as intended where a horizontal scrollbar reads as a
 * mistake. The code keeps its own overflow, so the line is still there to scroll to, and a
 * mask fades the last few percent instead of chopping a glyph in half.
 *
 * Each of our identifiers carries its own accent, the same hue the plugin has in the table
 * below and on its documentation. The colours are the literals from ACCENT_COLORS rather than
 * `var(--accent)`: this plate lives inside a dark ThemeBand, and a `light-dark()` accent in a
 * custom property resolves against the page theme, not the band, so on a light page the
 * tokens would come out in the light twins over black.
 *
 * Real API. `consentPlugin`, `emailsPlugin`, `actionScheduler` and `vercelPlugin` are the
 * exported names, and the options shown are the required ones from each installation page —
 * keep it that way, a fictional config here would be caught by the first developer who tried
 * it.
 */

type Tok =
  /** Language keyword. */
  | { t: 'kw'; v: string }
  /** String literal. */
  | { t: 'str'; v: string }
  /** Punctuation, identifiers, everything unhighlighted. */
  | { t: 'x'; v: string }
  /** One of ours, drawn in its own accent. */
  | { t: 'ours'; v: string; brand: AccentId }

const imp = (name: string, brand: AccentId, pkg: string, pad: string): Tok[] => [
  { t: 'kw', v: 'import' },
  { t: 'x', v: ' { ' },
  { t: 'ours', v: name, brand },
  { t: 'x', v: ` }${pad} ` },
  { t: 'kw', v: 'from' },
  { t: 'x', v: ' ' },
  { t: 'str', v: `'@payload-solutions/${pkg}'` },
]

const register = (name: string, brand: AccentId, options: string): Tok[] => [
  { t: 'x', v: '    ' },
  { t: 'ours', v: name, brand },
  { t: 'x', v: `(${options}),` },
]

const LINES: Tok[][] = [
  imp('consentPlugin', 'consent', 'plugin-consent', '  '),
  imp('emailsPlugin', 'emails', 'plugin-emails', '   '),
  imp('actionScheduler', 'scheduler', 'plugin-action-scheduler', ''),
  imp('vercelPlugin', 'vercel', 'plugin-vercel', '   '),
  [],
  [
    { t: 'kw', v: 'export default' },
    { t: 'x', v: ' buildConfig({' },
  ],
  [
    { t: 'x', v: '  plugins: [' },
  ],
  register('consentPlugin', 'consent', '{ seed }'),
  register('emailsPlugin', 'emails', '{ emails }'),
  register('actionScheduler', 'scheduler', '{ actions }'),
  register('vercelPlugin', 'vercel', '{ targets }'),
  [{ t: 'x', v: '  ],' }],
  [{ t: 'x', v: '})' }],
]

const CLASS: Record<Exclude<Tok['t'], 'ours'>, string> = {
  kw: 'tok-p',
  str: 'tok-s',
  x: '',
}

export function ConfigPlate({ className }: { className?: string }) {
  return (
    <Parallax speed={-0.04} as="figure" className={`relative m-0 ${className ?? ''}`}>
      <div className="relative border border-border bg-surface lg:border-r-0">
        <Crosshairs />
        {/* Title bar: the file this would be, so the plate reads as an editor and not as a
            snippet floating in the band. */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <span className="font-mono text-xs text-fg-muted">src/payload.config.ts</span>
          <span className="label-mono">TypeScript</span>
        </div>
        <pre className="code-block p-4 text-[0.75rem] sm:p-6 sm:text-[0.8125rem] lg:[mask-image:linear-gradient(to_right,#000_86%,transparent_99%)]">
          <code>
            {LINES.map((line, i) => (
              <span key={i}>
                {line.map((tok, j) =>
                  tok.t === 'ours' ? (
                    <span key={j} style={{ color: ACCENT_COLORS[tok.brand].accent }}>
                      {tok.v}
                    </span>
                  ) : (
                    <span key={j} className={CLASS[tok.t] || undefined}>
                      {tok.v}
                    </span>
                  ),
                )}
                {'\n'}
              </span>
            ))}
          </code>
        </pre>
      </div>
      <figcaption className="mt-3 text-sm text-fg-muted">
        Every plugin we publish, in one config.
      </figcaption>
    </Parallax>
  )
}
