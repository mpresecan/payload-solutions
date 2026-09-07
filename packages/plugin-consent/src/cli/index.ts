import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { readProfileState } from '../audit/profile.js'
import { applyProposal, readProposals } from '../audit/proposals.js'
import { renderConsole, renderMarkdown, shouldFail } from '../audit/report.js'
import { runScan } from '../audit/scan.js'
import { latestAudit, saveAudit } from '../audit/store.js'
import type { Severity } from '../audit/types.js'
import { flagBool, flagString, parseArgs } from './args.js'
import { runInit } from './init.js'
import { closeProject, loadProject, toolVersion } from './load.js'
import { runMcpServer } from './mcp.js'

const HELP = `payload-consent — legal audit for a Payload project

  payload-consent init            wire up your agent: MCP server entry, the legal skill, AGENTS.md
  payload-consent scan            deterministic checks; no model, no network, no API key
  payload-consent mcp             stdio MCP server your agent connects to
  payload-consent apply           apply proposed drafts as draft versions
  payload-consent profile         show the compliance profile and what is still unanswered

Options
  --root <dir>        project root (default: working directory)
  --config <path>     payload config (default: found the way Payload finds it)

  scan
    --json <path>     write the machine-readable report
    --md <path>       write the human-readable report
    --save            also store the run in the admin (Legal audits)
    --fail-on <sev>   exit non-zero at blocker | warn | info (default: never)
    --quiet           only the summary line

  mcp
    --allow-drafts    let the agent write draft versions through consent_apply

  apply
    --allow-drafts    required to write anything
    --dry-run         validate and show the diff
    --slug <slug>     only this page

This tool contains no model code. It reads your project and your database, and hands the
result to whichever agent you already use. Not legal advice.
`

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const root = path.resolve(flagString(args, 'root') ?? process.cwd())
  const config = flagString(args, 'config')

  switch (args.command) {
    case 'init': {
      for (const line of runInit({ root, agent: flagString(args, 'agent'), force: flagBool(args, 'force') })) {
        process.stdout.write(`  ${line}\n`)
      }
      process.stdout.write('\nNext: run `payload-consent scan`, then ask your agent to audit the legal pages.\n')
      return 0
    }

    case 'mcp': {
      await runMcpServer({ allowDrafts: flagBool(args, 'allow-drafts'), root })
      return 0
    }

    case 'scan': {
      const { payload, options } = await loadProject({ root, config })
      const previous = await latestAudit(payload, options)
      const result = await runScan(payload, options, { root, previous: previous?.findings, toolVersion: toolVersion() })

      const jsonPath = flagString(args, 'json')
      if (jsonPath) {
        mkdirSync(path.dirname(path.resolve(root, jsonPath)), { recursive: true })
        writeFileSync(path.resolve(root, jsonPath), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
      }
      const mdPath = flagString(args, 'md')
      if (mdPath) {
        mkdirSync(path.dirname(path.resolve(root, mdPath)), { recursive: true })
        writeFileSync(path.resolve(root, mdPath), renderMarkdown(result), 'utf8')
      }
      if (flagBool(args, 'save')) {
        const saved = await saveAudit(payload, options, { result })
        if (saved) process.stdout.write(`stored as legal audit ${String(saved.id)}\n`)
      }

      if (flagBool(args, 'quiet')) {
        process.stdout.write(`${result.counts.blocker} blockers, ${result.counts.warn} warnings, ${result.counts.info} notices\n`)
      } else {
        process.stdout.write(`${renderConsole(result)}\n`)
      }
      if (result.profile.missing.length) {
        process.stdout.write(
          `\n${result.profile.missing.length} question(s) need a human. Ask your agent to run the audit — it will put them to you one at a time.\n`,
        )
      }
      const failOn = (flagString(args, 'fail-on') ?? 'never') as Severity | 'never'
      return shouldFail(result, failOn) ? 1 : 0
    }

    case 'profile': {
      const { payload, options } = await loadProject({ root, config })
      const state = await readProfileState(payload, options)
      if (state.complete) {
        process.stdout.write('The compliance profile is complete.\n')
        return 0
      }
      process.stdout.write(`${state.missing.length} unanswered:\n\n`)
      for (const question of state.missing) {
        process.stdout.write(`  ${question.question}\n    ${question.why}${question.cite ? ` (${question.cite})` : ''}\n\n`)
      }
      process.stdout.write('Answers are recorded by your agent through the consent_profile tool, or by hand in Consent settings → Compliance profile.\n')
      return 0
    }

    case 'apply': {
      const { payload, options } = await loadProject({ root, config })
      const allowDrafts = flagBool(args, 'allow-drafts')
      const dryRun = flagBool(args, 'dry-run')
      const slug = flagString(args, 'slug')
      const proposals = readProposals(root).filter((p) => !slug || p.page.slug === slug)
      if (!proposals.length) {
        process.stdout.write('No proposals in .consent/proposals.\n')
        return 0
      }
      let failed = 0
      for (const proposal of proposals) {
        const result = await applyProposal(payload, options, proposal, { allowDrafts, dryRun })
        const where = `${result.slug}${result.locale ? ` (${result.locale})` : ''}`
        process.stdout.write(`\n${where}: ${result.applied ? 'saved as a draft version' : (result.reason ?? 'not applied')}\n`)
        if (result.errors?.length) {
          failed++
          for (const error of result.errors) process.stdout.write(`  ✗ ${error}\n`)
        }
        if (result.diff) process.stdout.write(`${result.diff}\n`)
      }
      if (!allowDrafts && !dryRun) {
        process.stdout.write('\nNothing was written. Re-run with --allow-drafts to save these as draft versions (they are never published).\n')
      }
      return failed ? 1 : 0
    }

    default:
      process.stdout.write(HELP)
      return args.command === 'help' ? 0 : 1
  }
}

main()
  .then(async (code) => {
    await closeProject()
    process.exit(code)
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`payload-consent: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    await closeProject()
    process.exit(1)
  })
