import { ArrowUpRightIcon, ScaleIcon } from 'lucide-react'

import stack from '@/stack.config'

const AUDIT_DOCS = 'https://payload.solutions/docs/plugins/payload-consent/audit'

/** One step: the command or place, then what it is for. */
const STEPS: Array<{ title: string; code?: string; body: string }> = [
  {
    title: 'Say who you are',
    code: 'src/stack.config.ts → legal',
    body: 'Registered name, address and privacy contact. Every seeded document is written from these, and the pages ship with placeholders until they are filled in.',
  },
  {
    title: 'Point your own agent at the project',
    code: 'npx payload-consent init',
    body: 'Writes an MCP server entry and the legal skill, so the agent you already use — Claude Code, Cursor, Codex — can read and draft these documents. No API key, and no model bundled with the plugin.',
  },
  {
    title: 'Answer the compliance profile',
    code: 'npx payload-consent profile',
    body: 'Retention periods, legal bases, whether a DPO exists. Facts about you that no model may guess: a plausible invention gets published, a blank gets noticed. Drafting refuses to proceed while one a document depends on is unanswered.',
  },
  {
    title: 'Run the scan and fix the blockers',
    code: 'npx payload-consent scan',
    body: 'Checked by code, with no model involved: template tokens still printed literally, processor rows nobody verified, a dependency in package.json that no document discloses, a cookie policy that renders no table. Works against drafts, before launch.',
  },
  {
    title: 'Let the agent draft the prose',
    code: 'npx payload-consent apply --allow-drafts',
    body: 'It reads each page as markdown, proposes changes into .consent/proposals/ for you to diff, and applies them as draft versions. Every claim it makes about the text has to quote the text.',
  },
  {
    title: 'Publish by hand',
    code: 'Payload admin → Privacy → Legal pages',
    body: 'Nothing else can publish. None of this is legal advice: it reports where your documents and your configuration disagree. Have a lawyer read the result before you launch.',
  },
]

/**
 * Development-only note on the homepage: how to turn the seeded legal pages into documents that
 * are actually true about this project.
 *
 * It is never rendered in production. Delete this component and its import in
 * src/app/(frontend)/(marketing)/page.tsx once the documents are published.
 */
export function LegalSetupNotice() {
  if (process.env.NODE_ENV === 'production') return null

  return (
    <aside
      aria-label="Legal pages setup"
      className="mx-auto mt-8 max-w-6xl px-4 sm:px-6"
      data-legal-setup-notice=""
    >
      <div className="rounded-lg border border-dashed bg-muted/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ScaleIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-medium">Your legal pages are seeded, not written</h2>
          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            Development only
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {stack.name} shipped with a privacy policy, terms, a cookie policy and a processor register
          under <span className="text-foreground">/legal</span>. They are templates addressed to{' '}
          <span className="text-foreground">{stack.legal.company}</span> and they do not yet describe
          what this project does. Payload Consent turns them into documents that agree with the
          configuration — it derives the facts from the project, extracts the claims from the prose,
          and reports where the two disagree.
        </p>

        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{step.title}</h3>
                {step.code ? (
                  <code className="mt-1 block break-words font-mono text-xs text-muted-foreground">{step.code}</code>
                ) : null}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-xs text-muted-foreground">
          <a
            className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
            href={AUDIT_DOCS}
            rel="noreferrer"
            target="_blank"
          >
            Legal audit: the full guide
            <ArrowUpRightIcon aria-hidden className="size-3" />
          </a>
          <span className="ml-2">
            Delete <span className="font-mono">src/consent/legal-setup-notice.tsx</span> and its import
            in <span className="font-mono">src/app/(frontend)/(marketing)/page.tsx</span> once the
            documents are published.
          </span>
        </p>
      </div>
    </aside>
  )
}
