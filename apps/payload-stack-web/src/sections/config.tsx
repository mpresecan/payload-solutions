import { Crosshairs } from '@payload-solutions/brand/crosshairs'
import { SectionHead } from '@payload-solutions/brand/lattice'
import { Parallax } from '@payload-solutions/brand/parallax'
import { screens } from '@payload-solutions/brand/screens'
import { ThemedImage } from '@payload-solutions/brand/themed-image'
import { Reveal } from '@/components/reveal'

type Tok = [cls: 'k' | 's' | 'c' | 'p' | '', text: string]

/* Mirrors templates/payload-stack/src/stack.config.ts. Keep in sync. */
const LINES: Tok[][] = [
  [
    ['p', 'import'],
    ['', ' { defineStack } '],
    ['p', 'from'],
    ['', ' '],
    ['s', "'@/lib/stack'"],
  ],
  [],
  [
    ['p', 'export default'],
    ['', ' defineStack({'],
  ],
  [
    ['', '  '],
    ['k', 'name'],
    ['', ': '],
    ['s', "'Ridgeline'"],
    ['', ','],
  ],
  [
    ['', '  '],
    ['k', 'url'],
    ['', ': process.env.'],
    ['k', 'NEXT_PUBLIC_APP_URL'],
    ['', ','],
  ],
  [
    ['', '  '],
    ['k', 'support'],
    ['', ': { '],
    ['k', 'email'],
    ['', ': '],
    ['s', "'help@ridgeline.app'"],
    ['', ' },'],
  ],
  [],
  [
    ['', '  '],
    ['k', 'auth'],
    ['', ': {'],
  ],
  [
    ['', '    '],
    ['k', 'methods'],
    ['', ': ['],
    ['s', "'email-password'"],
    ['', ', '],
    ['s', "'magic-link'"],
    ['', ', '],
    ['s', "'passkey'"],
    ['', '],'],
  ],
  [
    ['', '    '],
    ['k', 'social'],
    ['', ': ['],
    ['s', "'google'"],
    ['', ', '],
    ['s', "'github'"],
    ['', '],'],
  ],
  [
    ['', '    '],
    ['k', 'twoFactor'],
    ['', ': '],
    ['s', 'true'],
    ['', ','],
  ],
  [['', '  },']],
  [],
  [
    ['', '  '],
    ['k', 'organizations'],
    ['', ': { '],
    ['k', 'enabled'],
    ['', ': '],
    ['s', 'true'],
    ['', ', '],
    ['k', 'allowUserToCreate'],
    ['', ': '],
    ['s', 'true'],
    ['', ', '],
    ['k', 'creatorRole'],
    ['', ': '],
    ['s', "'owner'"],
    ['', ' },'],
  ],
  [],
  [
    ['', '  '],
    ['k', 'billing'],
    ['', ': {'],
  ],
  [
    ['', '    '],
    ['k', 'provider'],
    ['', ': '],
    ['s', "'stripe'"],
    ['', ','],
  ],
  [
    ['', '    '],
    ['k', 'attachedTo'],
    ['', ': '],
    ['s', "'organization'"],
    ['', ',  '],
    ['c', "// or 'user'"],
  ],
  [
    ['', '    '],
    ['k', 'plans'],
    ['', ': ['],
  ],
  [['', '      {']],
  [
    ['', '        '],
    ['k', 'id'],
    ['', ': '],
    ['s', "'team'"],
    ['', ', '],
    ['k', 'name'],
    ['', ': '],
    ['s', "'Team'"],
    ['', ', '],
    ['k', 'seats'],
    ['', ': '],
    ['s', '25'],
    ['', ', '],
    ['k', 'trialDays'],
    ['', ': '],
    ['s', '14'],
    ['', ','],
  ],
  [
    ['', '        '],
    ['k', 'prices'],
    ['', ': [{ '],
    ['k', 'id'],
    ['', ': process.env.'],
    ['k', 'NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY'],
    ['', ', '],
    ['k', 'amount'],
    ['', ': '],
    ['s', '9900'],
    ['', ', '],
    ['k', 'interval'],
    ['', ': '],
    ['s', "'month'"],
    ['', ' }],'],
  ],
  [
    ['', '        '],
    ['k', 'features'],
    ['', ': ['],
    ['s', "'Up to 25 members'"],
    ['', ', '],
    ['s', "'Unlimited projects'"],
    ['', '],'],
  ],
  [
    ['', '        '],
    ['k', 'limits'],
    ['', ': { '],
    ['k', 'projects'],
    ['', ': '],
    ['s', '-1'],
    ['', ' },'],
  ],
  [['', '      },']],
  [['', '    ],']],
  [['', '  },']],
  [],
  [
    ['', '  '],
    ['k', 'legal'],
    ['', ': { '],
    ['k', 'company'],
    ['', ': '],
    ['s', "'Ridgeline Software Ltd'"],
    ['', ', '],
    ['k', 'jurisdiction'],
    ['', ': '],
    ['s', "'Ireland'"],
    ['', ' },'],
  ],
  [['', '})']],
]

export function Config() {
  return (
    <section
      id="config"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="config-heading"
    >
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="config-heading"
            eyebrow="stack.config.ts"
            title="Your whole product, described in one file."
            lead="Pricing page, checkout, entitlements, sign-in screens and legal pages all read from stack.config.ts. Change it once and everything follows."
          />
        </Reveal>

        <div className="col-grid mt-14 gap-y-8 lg:mt-20 lg:items-start">
          {/* Three columns for the file, one for what it produces. */}
          <Reveal className="min-w-0 lg:col-span-3 lg:pr-10">
            <div className="border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
                <span className="font-mono text-xs text-fg-muted">src/stack.config.ts</span>
                <span className="font-mono text-xs text-fg-subtle">TypeScript</span>
              </div>
              <pre className="code-block p-4 text-[0.75rem] sm:p-6 sm:text-[0.8125rem] lg:p-8">
                <code>
                  {LINES.map((line, i) => (
                    <span key={i}>
                      {line.map(([cls, text], j) => (
                        <span key={j} className={cls ? `tok-${cls}` : undefined}>
                          {text}
                        </span>
                      ))}
                      {'\n'}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </Reveal>

          {/* What the plans above turn into: the real pricing page, leading slightly on scroll. */}
          <Reveal className="min-w-0 lg:col-span-1 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
            <Parallax speed={-0.05} as="figure" className="relative m-0">
              <div className="scanline relative border border-border p-[6%]">
                <Crosshairs />
                <ThemedImage
                  {...screens.pricing}
                  sizes="(min-width: 1024px) 480px, 90vw"
                  className="block h-auto w-full border border-border-strong"
                />
              </div>
              <figcaption className="mt-3 text-sm text-fg-muted">
                The pricing page, generated from the plans in this file.
              </figcaption>
            </Parallax>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
