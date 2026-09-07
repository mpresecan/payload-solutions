import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Payload } from 'payload'

import config from '@payload-config'
import { getPluginOptions } from '@payload-solutions/plugin-consent'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { checklistFor, terminologyFor } from '../src/audit/checklists.js'
import { carryForward, runScan } from '../src/audit/scan.js'
import { countBySeverity, findingId, makeFinding } from '../src/audit/findings.js'
import { blockTokensIn, legalContentToMarkdown, invalidTokens, unresolvedTokensIn } from '../src/audit/markdown.js'
import { markdownToLegalContent } from '../src/seed/legal.js'
import { detectVendors, envKeysFrom, mapCollections } from '../src/audit/project.js'
import { evaluateProfile, readProfileState, recordProfileAnswers } from '../src/audit/profile.js'
import { applyProposal, diffLines, validateProposal, type Proposal } from '../src/audit/proposals.js'
import { renderConsole, renderMarkdown, shouldFail } from '../src/audit/report.js'
import { latestAudit, saveAudit, validateInferred } from '../src/audit/store.js'
import { TOOLS } from '../src/cli/mcp.js'
import type { Finding, ScanResult } from '../src/audit/types.js'
import type { ResolvedConsentPluginOptions } from '../src/types.js'

let payload: Payload
let options: ResolvedConsentPluginOptions
let scratch: string

const call = async (name: string, input: Record<string, unknown> = {}) => {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) throw new Error(`no tool ${name}`)
  const result = await tool.handler(input, { payload, options, root: scratch, configPath: '' })
  return { ...result, data: result.isError ? null : (JSON.parse(result.text) as Record<string, any>) }
}

beforeAll(async () => {
  payload = await getPayload({ config })
  options = getPluginOptions(payload)
  scratch = mkdtempSync(path.join(tmpdir(), 'consent-audit-'))
  // A fixture project: three vendors the dev seed already declares, and one it does not.
  writeFileSync(
    path.join(scratch, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: { stripe: '^1', '@sentry/nextjs': '^8', openai: '^4' }, devDependencies: {} }),
  )
  writeFileSync(path.join(scratch, '.env'), 'RESEND_API_KEY=secret-value-never-read\nDATABASE_URL=postgres://x\n')
})

afterAll(async () => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('the finding taxonomy', () => {
  test('ids are stable for the same subject and differ for different ones', () => {
    expect(findingId('seed/placeholder-text', ['privacy', 'en'])).toBe(findingId('seed/placeholder-text', ['privacy', 'en']))
    expect(findingId('seed/placeholder-text', ['privacy', 'en'])).not.toBe(findingId('seed/placeholder-text', ['privacy', 'pl']))
  })

  test('a finding takes its severity and source from the code', () => {
    const finding = makeFinding({ code: 'registry/unverified-processor', subject: ['x'], detail: 'd' })
    expect(finding.severity).toBe('blocker')
    expect(finding.source).toBe('deterministic')
    expect(finding.fix).toBeTruthy()
  })

  test('accepted findings do not count towards the totals', () => {
    const open = makeFinding({ code: 'registry/unverified-processor', subject: ['a'], detail: 'd' })
    const accepted: Finding = { ...makeFinding({ code: 'registry/unverified-processor', subject: ['b'], detail: 'd' }), status: 'accepted' }
    expect(countBySeverity([open, accepted])).toEqual({ blocker: 1, warn: 0, info: 0 })
  })

  test('acceptances carry into the next run and open findings stay open', () => {
    const a = makeFinding({ code: 'trackers/missing-duration', subject: ['a'], detail: 'd' })
    const b = makeFinding({ code: 'trackers/missing-duration', subject: ['b'], detail: 'd' })
    const carried = carryForward([a, b], [{ ...a, status: 'accepted', reason: 'vendor cookie, documented elsewhere' }])
    expect(carried.find((f) => f.id === a.id)?.status).toBe('accepted')
    expect(carried.find((f) => f.id === a.id)?.reason).toContain('documented elsewhere')
    expect(carried.find((f) => f.id === b.id)?.status).toBe('open')
  })
})

describe('the markdown round trip', () => {
  test('blocks survive a lap through markdown as the tokens the seeds use', async () => {
    const source = [
      '# Privacy Policy',
      '',
      'We process personal data as described below.',
      '',
      '{{policy-version}}',
      '',
      '## Who receives your data',
      '',
      '{{processor-table:recipients}}',
      '',
      '## Cookies',
      '',
      '{{cookie-table}}',
      '',
      '| Purpose | Basis |',
      '| --- | --- |',
      '| Accounts | Contract |',
    ].join('\n')

    const content = await markdownToLegalContent(payload, source)
    expect(blockTokensIn(content).sort()).toEqual(['{{cookie-table}}', '{{policy-version}}', '{{processor-table:recipients}}'])
    // Converted blocks are blocks, not text, so nothing is "unresolved".
    expect(unresolvedTokensIn(content)).toEqual([])

    const back = await legalContentToMarkdown(payload, content)
    expect(back).toContain('{{cookie-table}}')
    expect(back).toContain('{{processor-table:recipients}}')
    expect(back).toContain('{{policy-version}}')
    expect(back).toContain('Who receives your data')
    expect(back).toContain('Accounts')

    // And back again, with the same blocks: the trip is lossless for what we care about.
    const second = await markdownToLegalContent(payload, back)
    expect(blockTokensIn(second).sort()).toEqual(blockTokensIn(content).sort())
  })

  test('a token that never became a block is detectable in stored content', async () => {
    const content = await markdownToLegalContent(payload, 'Intro\n\n{{cookie-tabel}}\n')
    expect(unresolvedTokensIn(content)).toEqual(['{{cookie-tabel}}'])
  })

  test('unknown tokens in agent markdown are rejected, known ones are not', () => {
    expect(invalidTokens('a {{cookie-table}} b {{processor-table:annex}}')).toEqual([])
    expect(invalidTokens('{{processor-table:nonsense}}')).toEqual(['{{processor-table:nonsense}}'])
  })
})

describe('project facts', () => {
  test('vendors are detected from dependencies and from environment variable names', () => {
    const vendors = detectVendors(scratch)
    const names = vendors.map((v) => v.name)
    expect(names).toContain('Stripe')
    expect(names).toContain('Sentry')
    expect(names).toContain('Resend')

    // The variable name and its value never leave this function.
    const serialised = JSON.stringify(vendors)
    expect(serialised).not.toContain('RESEND_API_KEY')
    expect(serialised).not.toContain('secret-value-never-read')
  })

  test('env parsing collects keys, never values, and never the ambient environment', () => {
    const keys = envKeysFrom(scratch)
    expect(keys).toContain('RESEND_API_KEY')
    expect(keys.join(' ')).not.toContain('secret-value-never-read')
    // Whoever runs the command has their own shell full of credentials; none of it is evidence
    // about the project being audited.
    process.env.PAYLOAD_CONSENT_AMBIENT_PROBE = 'x'
    expect(envKeysFrom(scratch)).not.toContain('PAYLOAD_CONSENT_AMBIENT_PROBE')
    delete process.env.PAYLOAD_CONSENT_AMBIENT_PROBE
  })

  test('the data map reads personal data out of the Payload schema and excludes consent records', () => {
    const map = mapCollections(payload.config.collections, options)
    const users = map.find((c) => c.slug === 'users')
    expect(users?.auth).toBe(true)
    expect(users?.categories).toContain('account')

    const records = map.find((c) => c.slug === String(options.slugs.records))
    expect(records?.excluded).toMatch(/never included/i)
    expect(records?.fields).toEqual([])
  })
})

describe('the deterministic scan', () => {
  let result: ScanResult

  beforeAll(async () => {
    result = await runScan(payload, options, { root: scratch, toolVersion: 'test' })
  })

  test('every finding it raises is checked by code, never judged', () => {
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings.every((f) => f.source === 'deterministic')).toBe(true)
  })

  test('seeded processor rows are blockers until someone verifies them', () => {
    const unverified = result.findings.filter((f) => f.code === 'registry/unverified-processor')
    expect(unverified.length).toBeGreaterThan(0)
    expect(unverified[0].severity).toBe('blocker')
    expect(unverified[0].evidence.join(' ')).toContain('verified = false')
  })

  test('the sample company left in the seeded pages is caught as a placeholder', () => {
    const placeholders = result.findings.filter((f) => f.code === 'seed/placeholder-text')
    expect(placeholders.length).toBeGreaterThan(0)
    expect(placeholders.some((f) => /acme|example\./i.test(f.quote ?? ''))).toBe(true)
  })

  test('a vendor wired into the project but absent from the register is reported, and a declared one is not', () => {
    const undisclosed = result.findings.filter((f) => f.code === 'registry/undisclosed-vendor')
    const text = undisclosed.map((f) => f.detail).join(' ')
    expect(text).toContain('OpenAI')
    // Stripe, Sentry and Resend are all in the seeded register, so they must not be reported.
    expect(text).not.toMatch(/Stripe|Sentry|Resend/)
    expect(undisclosed[0].evidence.join(' ')).toMatch(/depends on|configured in this environment/)
  })

  test('unanswered compliance questions are blockers, with the reason the law needs them', () => {
    const needsInput = result.findings.filter((f) => f.code === 'profile/needs-input')
    expect(needsInput.length).toBeGreaterThan(0)
    expect(needsInput.some((f) => f.detail.length > 20)).toBe(true)
    expect(result.profile.complete).toBe(false)
  })

  test('counts, console and markdown reports agree with the findings', () => {
    const open = result.findings.filter((f) => f.status !== 'accepted')
    expect(result.counts.blocker + result.counts.warn + result.counts.info).toBe(open.length)
    expect(renderConsole(result, { color: false })).toContain('blockers')
    const md = renderMarkdown(result)
    expect(md).toContain('# Legal audit')
    expect(md).toContain('Not legal advice')
    expect(md).toContain('Consent records were not read')
    expect(shouldFail(result, 'blocker')).toBe(true)
    expect(shouldFail(result, 'never')).toBe(false)
  })
})

describe('the compliance profile', () => {
  test('a profile with nothing filled in is entirely unanswered', () => {
    const state = evaluateProfile({})
    expect(state.complete).toBe(false)
    expect(state.missing.map((q) => q.key)).toContain('legalName')
    expect(state.missing.every((q) => q.why.length > 20)).toBe(true)
  })

  test('recorded answers land on typed fields and keep their provenance', async () => {
    const before = await readProfileState(payload, options)
    expect(before.complete).toBe(false)

    const after = await recordProfileAnswers(
      payload,
      options,
      {
        answers: [
          { key: 'legalName', answer: 'Fixture Ltd' },
          { key: 'role', answer: 'controller' },
          { key: 'dpo', answer: 'no' },
          { key: 'retention', answer: 'accounts: 24 months after closure\ninvoices: 5 years' },
        ],
        answeredBy: 'test',
      },
      undefined,
    )

    expect(after.profile.legalName).toBe('Fixture Ltd')
    expect(after.profile.role).toBe('controller')
    expect(after.profile.dpo?.required).toBe('no')
    expect(after.profile.retention?.[0]).toEqual({ purpose: 'accounts', period: '24 months after closure' })
    const recorded = after.profile.answers?.find((a) => a.key === 'legalName')
    expect(recorded?.answeredBy).toBe('test')
    expect(recorded?.answeredAt).toBeTruthy()
    expect(after.missing.map((q) => q.key)).not.toContain('legalName')
  })
})

describe('proposals', () => {
  const draft = (markdown: string, extra: Partial<Proposal> = {}): Proposal => ({
    version: 1,
    createdAt: new Date().toISOString(),
    page: { slug: 'privacy' },
    markdown,
    rationale: 'test',
    ...extra,
  })

  test('a draft is refused while the facts it depends on are unanswered', async () => {
    const validation = await validateProposal(payload, options, draft('# Privacy Policy\n\nSomething.\n'))
    expect(validation.ok).toBe(false)
    expect(validation.errors.join(' ')).toMatch(/not been answered by a human/)
    expect(validation.needsInput.length).toBeGreaterThan(0)
    expect(validation.needsInput[0].question).toBeTruthy()
  })

  test('placeholders and unknown tokens are refused outright', async () => {
    const validation = await validateProposal(payload, options, draft('# Privacy\n\nContact [COMPANY NAME] at hello@example.com.\n\n{{cookie-tabel}}\n'))
    expect(validation.ok).toBe(false)
    expect(validation.errors.join(' ')).toMatch(/placeholder/)
    expect(validation.errors.join(' ')).toMatch(/unknown tokens/)
  })

  test('once the questions are answered the same draft validates and produces a diff', async () => {
    await recordProfileAnswers(payload, options, {
      answers: [
        { key: 'address', answer: '1 Somewhere Street, Warsaw' },
        { key: 'contactEmail', answer: 'privacy@fixture.test' },
        { key: 'establishmentCountry', answer: 'PL' },
        { key: 'audience', answer: 'b2b' },
        { key: 'legalBases', answer: 'accounts: contract\nanalytics: consent' },
        { key: 'dsrEmail', answer: 'privacy@fixture.test' },
        { key: 'supervisoryAuthority', answer: 'UODO' },
        { key: 'automatedDecisions', answer: 'none' },
        { key: 'governingLaw', answer: 'Poland' },
      ],
      answeredBy: 'test',
    })
    const state = await readProfileState(payload, options)
    expect(state.complete).toBe(true)

    const validation = await validateProposal(payload, options, draft('# Privacy Policy\n\nWe are the controller.\n\n{{cookie-table}}\n'))
    expect(validation.ok).toBe(true)
    expect(validation.diff).toBeTruthy()
    expect(validation.diff).toMatch(/^[+-] /m)
  })

  test('applying does nothing unless writing was turned on, and never publishes', async () => {
    const proposal = draft('# Privacy Policy\n\nA revised opening paragraph.\n\n{{cookie-table}}\n')

    const refused = await applyProposal(payload, options, proposal, {})
    expect(refused.applied).toBe(false)
    expect(refused.reason).toMatch(/--allow-drafts/)

    const dry = await applyProposal(payload, options, proposal, { allowDrafts: true, dryRun: true })
    expect(dry.applied).toBe(false)
    expect(dry.reason).toBe('dry run')

    const before = await payload.find({ collection: options.slugs.legalPages, where: { slug: { equals: 'privacy' } }, overrideAccess: true })
    expect((before.docs[0] as { _status?: string })._status).toBe('published')

    const applied = await applyProposal(payload, options, proposal, { allowDrafts: true })
    expect(applied.applied).toBe(true)

    // The published document is untouched; the change is waiting as a draft version.
    const published = await payload.find({
      collection: options.slugs.legalPages,
      where: { slug: { equals: 'privacy' } },
      draft: false,
      overrideAccess: true,
    })
    const publishedText = JSON.stringify(published.docs[0])
    expect(publishedText).not.toContain('A revised opening paragraph')

    const versions = await payload.findVersions({
      collection: options.slugs.legalPages,
      where: { 'version._status': { equals: 'draft' } },
      overrideAccess: true,
      limit: 5,
      sort: '-updatedAt',
    })
    expect(JSON.stringify(versions.docs)).toContain('A revised opening paragraph')
  })

  test('the diff shows what changed and elides what did not', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n')
    const after = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'CHANGED'].join('\n')
    const diff = diffLines(before, after)
    expect(diff).toContain('+ CHANGED')
    expect(diff).toContain('- h')
    expect(diff).toMatch(/unchanged lines/)
  })
})

describe('stored audits', () => {
  test('a model-judged finding without a quote is rejected', () => {
    const errors = validateInferred([
      {
        id: 'x',
        code: 'art13/missing-disclosure',
        severity: 'blocker',
        source: 'inferred',
        title: 'No retention period',
        detail: 'The policy never says how long anything is kept.',
        evidence: [],
      },
    ])
    expect(errors.join(' ')).toMatch(/must quote/)
  })

  test('a deterministic claim from the model is rejected, and an unknown code too', () => {
    const errors = validateInferred([
      { id: 'a', code: 'art13/missing-disclosure', severity: 'warn', source: 'deterministic', title: 't', detail: 'd', quote: 'q', evidence: [] },
      { id: 'b', code: 'made/up', severity: 'warn', source: 'inferred', title: 't', detail: 'd', quote: 'q', evidence: [] },
    ])
    expect(errors.join(' ')).toMatch(/only the scan may report deterministic findings/)
    expect(errors.join(' ')).toMatch(/unknown finding code/)
  })

  test('an audit is stored, read back, and is not public', async () => {
    const result = await runScan(payload, options, { root: scratch, toolVersion: 'test' })
    const saved = await saveAudit(payload, options, {
      result,
      inferred: [
        {
          id: 'inf-1',
          code: 'art13/vague-disclosure',
          severity: 'warn',
          source: 'inferred',
          title: 'Retention is described only as "as long as necessary"',
          detail: 'Art. 13(2)(a) wants a period or the criteria.',
          quote: 'We keep your data for as long as necessary.',
          evidence: ['privacy policy, retention section'],
        },
      ],
      agent: 'test-agent',
      model: 'test-model',
    })
    expect(saved?.id).toBeTruthy()

    const latest = await latestAudit(payload, options)
    expect(latest?.findings.length).toBeGreaterThan(0)

    const doc = await payload.findByID({ collection: options.slugs.audits, id: saved!.id, overrideAccess: true })
    expect((doc as { agent?: string }).agent).toBe('test-agent')

    const collection = payload.config.collections.find((c) => c.slug === String(options.slugs.audits))
    expect(collection).toBeTruthy()
    const anonymous = await collection!.access.read({ req: { user: null } as never })
    expect(anonymous).toBe(false)
    // Legal pages, by contrast, are public.
    const legal = payload.config.collections.find((c) => c.slug === String(options.slugs.legalPages))
    expect(await legal!.access.read({ req: { user: null } as never })).toBe(true)
  })

  test('accepting a finding requires a reason', async () => {
    const collection = payload.config.collections.find((c) => c.slug === String(options.slugs.audits))!
    const findings = collection.fields.find((f) => 'name' in f && f.name === 'findings') as { fields: Array<Record<string, any>> }
    const reason = findings.fields.find((f) => f.name === 'reason')!
    expect(await reason.validate('', { siblingData: { status: 'accepted' } })).toMatch(/reason/)
    expect(await reason.validate('we accept this risk', { siblingData: { status: 'accepted' } })).toBe(true)
    expect(await reason.validate('', { siblingData: { status: 'open' } })).toBe(true)
  })
})

describe('checklists and language', () => {
  test('the DPA checklist covers all eight Article 28(3) clauses', () => {
    const dpa = checklistFor('dpa')!
    const cites = dpa.requirements.map((r) => r.cite).join(' ')
    for (const letter of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(cites).toContain(`28(3)(${letter})`)
    }
  })

  test('the privacy checklist names the profile keys each requirement depends on', () => {
    const privacy = checklistFor('privacy')!
    const retention = privacy.requirements.find((r) => r.id === 'retention')!
    expect(retention.needsInput).toContain('retention')
    expect(retention.cite).toBe('Art. 13(2)(a)')
  })

  test('terminology comes back per language, with the false friends named', () => {
    const pl = terminologyFor('pl')
    expect(pl.terms?.controller).toBe('administrator')
    expect(pl.falseFriends?.some((f) => f.wrong === 'kontroler')).toBe(true)

    const hr = terminologyFor('hr-HR')
    expect(hr.terms?.consent).toBe('privola')

    const unknown = terminologyFor('mt')
    expect(unknown.terms).toBeUndefined()
    expect(unknown.note).toMatch(/official text/i)
  })
})

describe('the MCP tool surface', () => {
  test('every tool has a schema and a description that says what it is for', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'consent_scan',
      'consent_data_map',
      'consent_list_pages',
      'consent_read_page',
      'consent_registry',
      'consent_checklist',
      'consent_profile',
      'consent_propose',
      'consent_report',
      'consent_apply',
    ])
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(40)
      expect(tool.inputSchema).toHaveProperty('type', 'object')
    }
  })

  test('consent_scan returns findings and the not-legal-advice note', async () => {
    const { data } = await call('consent_scan')
    expect(data!.findings.length).toBeGreaterThan(0)
    expect(data!.note).toMatch(/Not legal advice/)
  })

  test('consent_read_page returns markdown with tokens and the locale glossary', async () => {
    const { data } = await call('consent_read_page', { slug: 'cookies' })
    expect(data!.markdown).toContain('{{cookie-table}}')
    expect(data!.terminology.terms.controller).toBe('controller')
  })

  test('consent_read_page reports a missing page instead of inventing one', async () => {
    const result = await call('consent_read_page', { slug: 'not-a-page' })
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/No legal page/)
  })

  test('consent_data_map exposes vendors and states that records are excluded', async () => {
    const { data } = await call('consent_data_map')
    expect(data!.excluded).toMatch(/never read/i)
    expect(Array.isArray(data!.vendors)).toBe(true)
  })

  test('consent_checklist filters by the compliance profile and returns citations', async () => {
    const { data } = await call('consent_checklist', { kind: 'privacy', locale: 'pl' })
    expect(data!.requirements.some((r: { cite: string }) => r.cite === 'Art. 13(1)(a)')).toBe(true)
    expect(data!.terminology.terms.processor).toBe('podmiot przetwarzający')
  })

  test('consent_propose refuses an unknown token and never writes a file for it', async () => {
    const { data } = await call('consent_propose', {
      slug: 'privacy',
      markdown: '# Privacy\n\n{{cookie-tabel}}\n',
      rationale: 'testing the guard',
    })
    expect(data!.ok).toBe(false)
    expect(JSON.stringify(data!.errors)).toMatch(/unknown tokens/)
  })

  test('consent_apply is refused while writing is off', async () => {
    delete process.env.PAYLOAD_CONSENT_ALLOW_DRAFTS
    await call('consent_propose', {
      slug: 'privacy',
      markdown: '# Privacy Policy\n\nProposed through MCP.\n\n{{cookie-table}}\n',
      rationale: 'testing the write gate',
    })
    const { data } = await call('consent_apply', {})
    expect(data!.allowDrafts).toBe(false)
    expect(JSON.stringify(data!.results)).toMatch(/--allow-drafts/)
  })

  test('consent_report rejects an inferred finding with no quote and stores a good one', async () => {
    const bad = await call('consent_report', {
      inferred: [{ code: 'art13/missing-disclosure', title: 'x', detail: 'y', quote: '' }],
    })
    expect(bad.data!.ok).toBe(false)

    const good = await call('consent_report', {
      inferred: [
        {
          code: 'art13/missing-disclosure',
          title: 'No supervisory authority named',
          detail: 'The right to complain is stated without saying to whom.',
          quote: 'You have the right to lodge a complaint.',
          severity: 'blocker',
          slug: 'privacy',
        },
      ],
      agent: 'vitest',
      model: 'none',
    })
    expect(good.data!.ok).toBe(true)
    expect(good.data!.inferredCount).toBe(1)
  })
})
