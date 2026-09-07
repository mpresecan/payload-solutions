import type { Finding, ScanResult, Severity } from './types.js'

const LABEL: Record<Severity, string> = { blocker: 'Blocker', warn: 'Warning', info: 'Notice' }
const MARK: Record<Severity, string> = { blocker: '✗', warn: '!', info: '·' }

const open = (findings: Finding[]) => findings.filter((f) => f.status !== 'accepted')

/** The report a human reads. Deterministic findings first, because they are the ones that are certain. */
export function renderMarkdown(result: ScanResult): string {
  const lines: string[] = []
  const live = open(result.findings)
  const accepted = result.findings.filter((f) => f.status === 'accepted')

  lines.push('# Legal audit')
  lines.push('')
  lines.push(`Run ${result.scannedAt.slice(0, 19).replace('T', ' ')} UTC · payload-consent ${result.toolVersion}`)
  lines.push('')
  lines.push(
    `**${result.counts.blocker} blockers, ${result.counts.warn} warnings, ${result.counts.info} notices**` +
      (accepted.length ? ` · ${accepted.length} previously accepted` : ''),
  )
  lines.push('')
  lines.push('> Not legal advice. This report checks your documents against your own configuration and the disclosures the law lists; it does not tell you whether your business is lawful.')
  lines.push('')

  if (!result.profile.complete) {
    lines.push('## Unanswered questions')
    lines.push('')
    lines.push('These are facts only you can supply. Nothing that depends on them can be drafted until they are answered.')
    lines.push('')
    for (const question of result.profile.missing) {
      lines.push(`- **${question.question}**  `)
      lines.push(`  ${question.why}${question.cite ? ` (${question.cite})` : ''}`)
    }
    lines.push('')
  }

  for (const severity of ['blocker', 'warn', 'info'] as Severity[]) {
    const group = live.filter((f) => f.severity === severity)
    if (!group.length) continue
    lines.push(`## ${LABEL[severity]}s`)
    lines.push('')
    for (const finding of group) {
      const where = finding.page ? ` — ${finding.page.slug}${finding.page.locale ? ` (${finding.page.locale})` : ''}` : ''
      lines.push(`### ${finding.title}${where}`)
      lines.push('')
      lines.push(finding.detail)
      lines.push('')
      if (finding.quote) {
        lines.push('> ' + finding.quote.replace(/\n/g, '\n> '))
        lines.push('')
      }
      if (finding.evidence.length) {
        lines.push('Evidence:')
        for (const item of finding.evidence) lines.push(`- ${item}`)
        lines.push('')
      }
      if (finding.fix) {
        lines.push(`**Fix.** ${finding.fix}`)
        lines.push('')
      }
      lines.push(`\`${finding.code}\` · ${finding.source === 'deterministic' ? 'checked by code' : 'judged by a model'} · \`${finding.id}\``)
      lines.push('')
    }
  }

  if (accepted.length) {
    lines.push('## Accepted')
    lines.push('')
    for (const finding of accepted) {
      lines.push(`- **${finding.title}** — ${finding.reason ?? 'no reason recorded'} (\`${finding.code}\`)`)
    }
    lines.push('')
  }

  lines.push('## What was looked at')
  lines.push('')
  lines.push(`- Locales: ${result.project.locales.join(', ') || 'none configured'}`)
  lines.push(`- Vendors detected in the project: ${result.project.vendors.map((v) => v.name).join(', ') || 'none'}`)
  lines.push(
    `- Personal data categories in the schema: ${result.project.categories.join(', ') || 'none detected'}`,
  )
  lines.push('- Consent records were not read. They are real personal data and are excluded from audits by design.')
  lines.push('')
  return lines.join('\n')
}

/** Compact terminal output. */
export function renderConsole(result: ScanResult, opts: { color?: boolean } = {}): string {
  const c = opts.color !== false && process.stdout.isTTY
  const dim = (s: string) => (c ? `\u001b[2m${s}\u001b[0m` : s)
  const red = (s: string) => (c ? `\u001b[31m${s}\u001b[0m` : s)
  const yellow = (s: string) => (c ? `\u001b[33m${s}\u001b[0m` : s)
  const bold = (s: string) => (c ? `\u001b[1m${s}\u001b[0m` : s)
  const paint: Record<Severity, (s: string) => string> = { blocker: red, warn: yellow, info: dim }

  const lines: string[] = []
  const live = open(result.findings)
  if (!live.length) {
    lines.push('No findings. Everything the scan can check agrees with your configuration.')
  }
  for (const severity of ['blocker', 'warn', 'info'] as Severity[]) {
    for (const finding of live.filter((f) => f.severity === severity)) {
      const where = finding.page ? dim(` ${finding.page.slug}${finding.page.locale ? `:${finding.page.locale}` : ''}`) : ''
      lines.push(`${paint[severity](MARK[severity])} ${finding.title}${where}`)
      lines.push(`  ${dim(finding.detail)}`)
      if (finding.fix) lines.push(`  ${dim('→ ' + finding.fix)}`)
      lines.push(`  ${dim(finding.code)}`)
    }
  }
  lines.push('')
  lines.push(
    bold(`${result.counts.blocker} blockers, ${result.counts.warn} warnings, ${result.counts.info} notices`) +
      (result.profile.missing.length ? dim(` · ${result.profile.missing.length} questions need a human`) : ''),
  )
  return lines.join('\n')
}

/** Exit code helper: `--fail-on warn` fails on warnings and blockers. */
export function shouldFail(result: ScanResult, failOn: Severity | 'never'): boolean {
  if (failOn === 'never') return false
  const order: Severity[] = ['blocker', 'warn', 'info']
  const limit = order.indexOf(failOn)
  return order.slice(0, limit + 1).some((severity) => result.counts[severity] > 0)
}
