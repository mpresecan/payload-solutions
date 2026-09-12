/**
 * src/scheduler.ts: the optional Payload Action Scheduler step, and the runner that goes with it.
 *
 * Like consent, the seam is a module rather than a set of markers: both branches of
 * `src/scheduler` export the same names, so payload.config.ts and src/lib/auth/options.ts are the
 * template's own files in either project. What is checked here is that the two branches really do
 * line up, that the dependency swap is total in both directions, and that each runner writes what
 * that host needs and nothing another host would inherit.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cp } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { stripWorkspaceDependencies, renderEnv } from '../src/configure'
import {
  applySchedulerChoice,
  renderVercelJson,
  RUNNER_CHOICES,
  RUNNER_KEYS,
  SCHEDULER_PACKAGE,
  SCHEDULER_VERSION,
  swapSchedulerPackages,
} from '../src/scheduler'
import { VARIANT_DIR } from '../src/variants'

const templateDir = path.resolve(__dirname, '../../../templates/payload-stack')
const variantDir = path.join(templateDir, VARIANT_DIR, 'scheduler-plugin')
const packageJson = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf8')) as Record<string, unknown>

/** Every file the seam is made of, by the name it has in both branches. */
const SEAM = ['plugin.ts', 'jobs.ts', 'hooks.ts']

const exportedNames = (source: string) =>
  [...source.matchAll(/export (?:const|function|async function) (\w+)/g)].map((m) => m[1]).sort()

describe('the template ships both branches', () => {
  it('keeps the un-plugged seam in src/scheduler and the plugin branch in variants', () => {
    for (const file of SEAM) {
      expect(existsSync(path.join(templateDir, 'src/scheduler', file)), file).toBe(true)
      expect(existsSync(path.join(variantDir, file)), `variant ${file}`).toBe(true)
    }
    // Only the plugged branch has a catalogue: there is nothing to schedule without a scheduler.
    expect(existsSync(path.join(variantDir, 'actions/index.ts'))).toBe(true)
    expect(existsSync(path.join(templateDir, 'src/scheduler/actions'))).toBe(false)
    expect(existsSync(path.join(variantDir, 'tests/scheduler.spec.ts'))).toBe(true)
  })

  it.each(SEAM)('%s exports the same names in both branches, so the call sites never change', (file) => {
    expect(exportedNames(readFileSync(path.join(templateDir, 'src/scheduler', file), 'utf8'))).toEqual(
      exportedNames(readFileSync(path.join(variantDir, file), 'utf8')),
    )
  })

  it('carries the plugin as a devDependency only, so variants/ typechecks in the monorepo', () => {
    expect((packageJson.devDependencies as Record<string, string>)[SCHEDULER_PACKAGE]).toBe('workspace:*')
    expect((packageJson.dependencies as Record<string, string>)[SCHEDULER_PACKAGE]).toBeUndefined()
  })

  it('reads the emails seam for the catalogue gate, and never the emails plugin itself', () => {
    // The plugin may not be installed. Both emails branches export `emailsEnabled` and the two
    // send helpers, which is the whole coupling between the two steps.
    for (const branch of ['src/emails/hooks.ts', 'variants/emails-plugin/hooks.ts']) {
      const names = exportedNames(readFileSync(path.join(templateDir, branch), 'utf8'))
      expect(names, branch).toEqual(expect.arrayContaining(['emailsEnabled', 'notify', 'sendPaymentReminder', 'sendTrialReminder']))
    }
    for (const file of ['actions/index.ts', 'actions/billing.ts', 'actions/emails.ts', 'hooks.ts']) {
      expect(readFileSync(path.join(variantDir, file), 'utf8'), file).not.toContain('plugin-emails')
    }
  })
})

describe('swapSchedulerPackages', () => {
  it('adds the plugin as a real dependency when the scheduler is on', () => {
    const result = swapSchedulerPackages(packageJson, true) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(result.dependencies[SCHEDULER_PACKAGE]).toBe(SCHEDULER_VERSION)
    // Never both: a workspace protocol resolves nowhere outside this repo.
    expect(result.devDependencies[SCHEDULER_PACKAGE]).toBeUndefined()
    expect(Object.keys(result.dependencies)).toEqual([...Object.keys(result.dependencies)].sort())
  })

  it('removes every trace when the scheduler is off', () => {
    const result = swapSchedulerPackages(packageJson, false) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(result.dependencies[SCHEDULER_PACKAGE]).toBeUndefined()
    expect(result.devDependencies[SCHEDULER_PACKAGE]).toBeUndefined()
  })

  it('is total: applying either answer to either result gives the same thing', () => {
    const on = swapSchedulerPackages(packageJson, true)
    const off = swapSchedulerPackages(packageJson, false)
    expect(swapSchedulerPackages(off, true)).toEqual(on)
    expect(swapSchedulerPackages(on, false)).toEqual(off)
    expect(swapSchedulerPackages(on, true)).toEqual(on)
    expect(swapSchedulerPackages(off, false)).toEqual(off)
  })

  it('leaves nothing with a workspace protocol behind either answer', () => {
    for (const enabled of [true, false]) {
      const result = stripWorkspaceDependencies(swapSchedulerPackages(packageJson, enabled)) as {
        dependencies: Record<string, string>
      }
      for (const version of Object.values(result.dependencies)) {
        expect(version.startsWith('workspace:')).toBe(false)
      }
      expect(Object.keys(result.dependencies).includes(SCHEDULER_PACKAGE)).toBe(enabled)
    }
  })
})

describe('the runners', () => {
  it('name and explain every choice, and recommend the one that needs no setup', () => {
    expect(RUNNER_KEYS[0]).toBe('clock')
    for (const key of RUNNER_KEYS) {
      const choice = RUNNER_CHOICES[key]
      expect(choice.label, key).toBeTruthy()
      expect(choice.hint, key).toBeTruthy()
      expect(choice.next().length, key).toBeGreaterThan(0)
      // Whichever one is picked, the note lists the others: a runner is host-specific and the
      // easiest part of this to change later.
      const note = choice.next().join('\n')
      expect(note, key).toContain('payloadclock.com')
      expect(note, key).toContain('vercel.json')
      expect(note, key).toContain('RUN_JOBS_IN_PROCESS')
      expect(note, key).toContain('Run queue')
    }
  })

  it('runs in process only on a long-lived server, and asks for a secret otherwise', () => {
    expect(RUNNER_CHOICES.server.inProcess).toBe(true)
    for (const key of ['clock', 'vercel', 'later'] as const) {
      expect(RUNNER_CHOICES[key].inProcess, key).toBe(false)
    }
    // Nothing calls the endpoint under "decide later", so no secret is written for it.
    expect(RUNNER_CHOICES.later.cronSecret).toBe(false)
    for (const key of ['clock', 'vercel', 'server'] as const) {
      expect(RUNNER_CHOICES[key].cronSecret, key).toBe(true)
    }
  })

  it('writes a vercel.json that runs the queue, schema first', () => {
    const parsed = JSON.parse(renderVercelJson()) as { $schema: string; crons: Array<{ path: string; schedule: string }> }
    expect(parsed.$schema).toContain('vercel')
    expect(parsed.crons).toHaveLength(1)
    expect(parsed.crons[0]!.path).toBe('/api/payload-jobs/run?allQueues=true')
    expect(parsed.crons[0]!.schedule).toBe('* * * * *')
    expect(renderVercelJson().endsWith('\n')).toBe(true)
  })
})

describe('the environment', () => {
  const example = readFileSync(path.join(templateDir, '.env.example'), 'utf8')

  it('documents both variables, commented out, so a project without a scheduler has neither set', () => {
    expect(example).toMatch(/^# CRON_SECRET=$/m)
    expect(example).toMatch(/^# RUN_JOBS_IN_PROCESS=/m)
    const env = renderEnv(example, { connectionString: 'postgres://x' })
    expect(env).not.toMatch(/^CRON_SECRET=/m)
    expect(env).not.toMatch(/^RUN_JOBS_IN_PROCESS=/m)
  })

  it('writes a fresh secret for the runners that need one, and only then', () => {
    const withSecret = renderEnv(example, { connectionString: 'postgres://x', cronSecret: true })
    expect(withSecret).toMatch(/^CRON_SECRET=[A-Za-z0-9_-]{40,}$/m)
    expect(withSecret).not.toMatch(/^RUN_JOBS_IN_PROCESS=/m)
    // Two projects never share a secret.
    expect(renderEnv(example, { connectionString: 'postgres://x', cronSecret: true })).not.toBe(withSecret)
  })

  it('turns the in-process runner on for a long-lived server', () => {
    const env = renderEnv(example, { connectionString: 'postgres://x', cronSecret: true, inProcessRunner: true })
    expect(env).toMatch(/^RUN_JOBS_IN_PROCESS=true$/m)
    expect(env).toMatch(/^CRON_SECRET=/m)
  })
})

describe('applySchedulerChoice', () => {
  let root: string

  beforeAll(async () => {
    root = mkdtempSync(path.join(os.tmpdir(), 'cps-scheduler-'))
    for (const dir of ['on', 'off']) {
      // Only what the step touches, so a failure here is about the step and nothing else.
      await cp(variantDir, path.join(root, dir, VARIANT_DIR, 'scheduler-plugin'), { recursive: true })
      await cp(path.join(templateDir, 'src/scheduler'), path.join(root, dir, 'src/scheduler'), { recursive: true })
      await cp(path.join(templateDir, 'tests/unit/setup.ts'), path.join(root, dir, 'tests/unit/setup.ts'))
    }
    await applySchedulerChoice(path.join(root, 'on'), true)
    await applySchedulerChoice(path.join(root, 'off'), false)
  })

  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('moves the plugin branch, its catalogue and its spec into place', () => {
    for (const file of [...SEAM.map((f) => `src/scheduler/${f}`), 'src/scheduler/actions/index.ts', 'src/scheduler/actions/billing.ts', 'src/scheduler/actions/maintenance.ts', 'src/scheduler/actions/emails.ts', 'tests/unit/scheduler.spec.ts']) {
      expect(existsSync(path.join(root, 'on', file)), file).toBe(true)
    }
    expect(readFileSync(path.join(root, 'on', 'src/scheduler/plugin.ts'), 'utf8')).toContain('actionScheduler(')
  })

  it('leaves the un-plugged seam exactly as it was when the answer is no', () => {
    for (const file of SEAM) {
      expect(readFileSync(path.join(root, 'off', 'src/scheduler', file), 'utf8')).toBe(
        readFileSync(path.join(templateDir, 'src/scheduler', file), 'utf8'),
      )
    }
    expect(existsSync(path.join(root, 'off', 'src/scheduler/actions'))).toBe(false)
    expect(existsSync(path.join(root, 'off', 'tests/unit/scheduler.spec.ts'))).toBe(false)
  })

  it('fails loudly rather than scaffolding half a scheduler', async () => {
    const empty = path.join(root, 'empty')
    await cp(path.join(templateDir, 'src/scheduler'), path.join(empty, 'src/scheduler'), { recursive: true })
    await expect(applySchedulerChoice(empty, true)).rejects.toThrow(/missing/)
  })
})
