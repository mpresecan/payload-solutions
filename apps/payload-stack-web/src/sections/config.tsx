import { Reveal } from '@/components/reveal'

type Tok = [cls: 'k' | 's' | 'c' | 'p' | '', text: string]

/* Mirrors templates/payload-stack/src/stack.config.ts. Keep in sync. */
const LINES: Tok[][] = [
  [['p', 'import'], ['', ' { defineStack } '], ['p', 'from'], ['', ' '], ['s', "'@/lib/stack'"]],
  [],
  [['p', 'export default'], ['', ' defineStack({']],
  [['', '  '], ['k', 'name'], ['', ': '], ['s', "'Ridgeline'"], ['', ',']],
  [['', '  '], ['k', 'url'], ['', ': process.env.'], ['k', 'NEXT_PUBLIC_APP_URL'], ['', ',']],
  [['', '  '], ['k', 'support'], ['', ': { '], ['k', 'email'], ['', ': '], ['s', "'help@ridgeline.app'"], ['', ' },']],
  [],
  [['', '  '], ['k', 'auth'], ['', ': {']],
  [['', '    '], ['k', 'methods'], ['', ': ['], ['s', "'email-password'"], ['', ', '], ['s', "'magic-link'"], ['', ', '], ['s', "'passkey'"], ['', '],']],
  [['', '    '], ['k', 'social'], ['', ': ['], ['s', "'google'"], ['', ', '], ['s', "'github'"], ['', '],']],
  [['', '    '], ['k', 'twoFactor'], ['', ': '], ['s', 'true'], ['', ',']],
  [['', '  },']],
  [],
  [['', '  '], ['k', 'organizations'], ['', ': { '], ['k', 'enabled'], ['', ': '], ['s', 'true'], ['', ', '], ['k', 'allowUserToCreate'], ['', ': '], ['s', 'true'], ['', ', '], ['k', 'creatorRole'], ['', ': '], ['s', "'owner'"], ['', ' },']],
  [],
  [['', '  '], ['k', 'billing'], ['', ': {']],
  [['', '    '], ['k', 'provider'], ['', ': '], ['s', "'stripe'"], ['', ',']],
  [['', '    '], ['k', 'attachedTo'], ['', ': '], ['s', "'organization'"], ['', ',  '], ['c', "// or 'user'"]],
  [['', '    '], ['k', 'plans'], ['', ': [']],
  [['', '      {']],
  [['', '        '], ['k', 'id'], ['', ': '], ['s', "'team'"], ['', ', '], ['k', 'name'], ['', ': '], ['s', "'Team'"], ['', ', '], ['k', 'seats'], ['', ': '], ['s', '25'], ['', ', '], ['k', 'trialDays'], ['', ': '], ['s', '14'], ['', ',']],
  [['', '        '], ['k', 'prices'], ['', ': [{ '], ['k', 'id'], ['', ': process.env.'], ['k', 'NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY'], ['', ', '], ['k', 'amount'], ['', ': '], ['s', '9900'], ['', ', '], ['k', 'interval'], ['', ': '], ['s', "'month'"], ['', ' }],']],
  [['', '        '], ['k', 'features'], ['', ': ['], ['s', "'Up to 25 members'"], ['', ', '], ['s', "'Unlimited projects'"], ['', '],']],
  [['', '        '], ['k', 'limits'], ['', ': { '], ['k', 'projects'], ['', ': '], ['s', '-1'], ['', ' },']],
  [['', '      },']],
  [['', '    ],']],
  [['', '  },']],
  [],
  [['', '  '], ['k', 'legal'], ['', ': { '], ['k', 'company'], ['', ': '], ['s', "'Ridgeline Software Ltd'"], ['', ', '], ['k', 'jurisdiction'], ['', ': '], ['s', "'Ireland'"], ['', ' },']],
  [['', '})']],
]

export function Config() {
  return (
    <section id="config" className="scroll-mt-header hairline-t py-section" aria-labelledby="config-heading">
      <div className="container-content">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 id="config-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
            Your whole product, described in one file.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-pretty text-lg leading-relaxed text-fg-muted">
            Pricing page, checkout, entitlements, sign-in screens and legal pages all read from
            stack.config.ts. Change it once and everything follows.
          </p>
        </Reveal>

        <Reveal className="mx-auto mt-12 min-w-0 max-w-4xl">
          <div className="border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="font-mono text-xs text-fg-muted">src/stack.config.ts</span>
              <span className="font-mono text-xs text-fg-subtle">TypeScript</span>
            </div>
            <pre className="code-block p-6 lg:p-8">
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
      </div>
    </section>
  )
}
