import { readFileSync } from 'node:fs'
import { writeSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import type { TypedLocale } from 'payload'

import { checklistFor, CHECKLISTS, terminologyFor } from '../audit/checklists.js'
import { legalContentToMarkdown } from '../audit/markdown.js'
import { PROFILE_QUESTIONS, recordProfileAnswers, readProfileState } from '../audit/profile.js'
import { applyProposal, readProposals, validateProposal, writeProposal, type Proposal } from '../audit/proposals.js'
import { runScan } from '../audit/scan.js'
import { latestAudit, saveAudit, validateInferred } from '../audit/store.js'
import type { Finding } from '../audit/types.js'
import type { AnyDoc } from '../types.js'
import { loadProject, toolVersion, type Project } from './load.js'

/**
 * A stdio MCP server, hand-rolled.
 *
 * The protocol here is newline-delimited JSON-RPC and about a hundred lines of dispatch. The
 * plugin already declined to depend on a third-party consent core for a 300-line state
 * machine; the same reasoning applies to a fast-moving SDK for a message loop. The result is
 * that this package contains no model code and no AI SDK at all — "model-agnostic" is the
 * absence of a wrapper rather than a wrapper over four providers.
 */

const PROTOCOL_FALLBACK = '2024-11-05'

/** JSON-RPC owns stdout. Everything else — pino, console.log — is pushed to stderr. */
function captureStdout(): void {
  const original = process.stdout.write.bind(process.stdout)
  const toStderr = (chunk: unknown, encoding?: unknown, callback?: unknown): boolean => {
    if (typeof encoding === 'function') return process.stderr.write(chunk as string, encoding as () => void)
    return process.stderr.write(chunk as string, encoding as BufferEncoding, callback as () => void)
  }
  process.stdout.write = toStderr as typeof process.stdout.write
  void original
}

function send(message: unknown): void {
  writeSync(1, `${JSON.stringify(message)}\n`)
}

type ToolResult = { text: string; isError?: boolean }

const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) })

type Tool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (input: Record<string, any>, project: Project) => Promise<ToolResult>
}

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

const str = (description: string) => ({ type: 'string', description })
const bool = (description: string) => ({ type: 'boolean', description })

const NOT_LEGAL_ADVICE =
  'Not legal advice. These tools compare documents against the project’s own configuration and the disclosures the law lists.'

async function pageDocs(project: Project, locale?: string): Promise<AnyDoc[]> {
  const { payload, options } = project
  const res = (await payload.find({
    collection: options.slugs.legalPages,
    depth: 0,
    limit: 200,
    pagination: false,
    overrideAccess: true,
    ...(locale ? { locale: locale as unknown as TypedLocale, fallbackLocale: false as unknown as TypedLocale } : {}),
  })) as unknown as { docs: AnyDoc[] }
  return res.docs
}

export const TOOLS: Tool[] = [
  {
    name: 'consent_scan',
    description:
      'Run the deterministic scan and return its findings. Everything it reports is proved by code, not judged: unresolved template tokens, unverified processor rows, missing locales, banner links, drift between the trackers and the cookie table. Run this FIRST and never re-derive what it already answered.',
    inputSchema: object({ root: str('Project root for dependency and environment detection. Defaults to the working directory.') }),
    handler: async (input, project) => {
      const previous = await latestAudit(project.payload, project.options)
      const result = await runScan(project.payload, project.options, {
        root: input.root ?? project.root,
        previous: previous?.findings,
        toolVersion: toolVersion(),
      })
      return json({ ...result, note: NOT_LEGAL_ADVICE })
    },
  },
  {
    name: 'consent_data_map',
    description:
      'What personal data this application actually stores and who it reaches, derived from the Payload schema, the dependencies in package.json and the names (never the values) of configured environment variables. Use it to check the privacy policy describes the real system rather than the one it described a year ago.',
    inputSchema: object({}),
    handler: async (_input, project) => {
      const result = await runScan(project.payload, project.options, { root: project.root, toolVersion: toolVersion() })
      return json({
        collections: result.project.collections,
        categories: result.project.categories,
        vendors: result.project.vendors,
        locales: result.project.locales,
        excluded: 'Consent records are never read: they are real personal data.',
      })
    },
  },
  {
    name: 'consent_list_pages',
    description: 'Every legal page with its kind, slug, locale, status, effective date and which generated blocks it renders.',
    inputSchema: object({ locale: str('Restrict to one locale.') }),
    handler: async (input, project) => {
      const locales = input.locale ? [input.locale as string] : project.payload.config.localization ? project.payload.config.localization.localeCodes.map(String) : [undefined]
      const pages: unknown[] = []
      for (const locale of locales) {
        for (const doc of await pageDocs(project, locale)) {
          pages.push({
            id: doc.id,
            slug: doc.slug,
            kind: doc.kind,
            title: doc.title,
            locale,
            status: doc._status ?? 'published',
            effectiveDate: doc.effectiveDate,
            updatedAt: doc.updatedAt,
          })
        }
      }
      return json({ pages })
    },
  },
  {
    name: 'consent_read_page',
    description:
      'Read one legal page as markdown. Generated tables come back as tokens ({{cookie-table}}, {{processor-table:recipients}}) — the same format the seed templates use. Edit that markdown and hand it to consent_propose; never write Lexical JSON.',
    inputSchema: object({ slug: str('Page slug, e.g. privacy'), locale: str('Locale code when the site is localised.') }, ['slug']),
    handler: async (input, project) => {
      const docs = await pageDocs(project, input.locale)
      const doc = docs.find((d) => String(d.slug) === String(input.slug))
      if (!doc) return { text: `No legal page with slug "${input.slug}"${input.locale ? ` in ${input.locale}` : ''}.`, isError: true }
      const markdown = await legalContentToMarkdown(project.payload, doc.content)
      return json({
        slug: doc.slug,
        kind: doc.kind,
        title: doc.title,
        locale: input.locale,
        status: doc._status ?? 'published',
        effectiveDate: doc.effectiveDate,
        markdown,
        terminology: terminologyFor(input.locale),
      })
    },
  },
  {
    name: 'consent_registry',
    description: 'Consent settings, categories, trackers and the processor register — the configured truth the prose is supposed to match.',
    inputSchema: object({ section: str('One of: settings, categories, trackers, processors. Omit for all.') }),
    handler: async (input, project) => {
      const { payload, options } = project
      const common = { depth: 0, limit: 500, pagination: false as const, overrideAccess: true }
      const want = (name: string) => !input.section || input.section === name
      const out: Record<string, unknown> = {}
      if (want('settings')) {
        const settings = (await payload.findGlobal({ slug: options.slugs.settings, depth: 0, overrideAccess: true })) as AnyDoc
        const { compliance, ...rest } = settings
        out.settings = rest
        out.compliance = compliance ?? {}
      }
      if (want('categories')) out.categories = ((await payload.find({ collection: options.slugs.categories, ...common })) as unknown as { docs: AnyDoc[] }).docs
      if (want('trackers')) out.trackers = ((await payload.find({ collection: options.slugs.trackers, ...common })) as unknown as { docs: AnyDoc[] }).docs
      if (want('processors') && options.processors) {
        out.processors = ((await payload.find({ collection: options.slugs.processors, ...common })) as unknown as { docs: AnyDoc[] }).docs
      }
      return json(out)
    },
  },
  {
    name: 'consent_checklist',
    description:
      'What a document of this kind must contain, as a list of requirements with their citations, plus the official GDPR terminology for the locale you are working in. Answer each requirement with a quote from the page; a requirement you cannot quote is not met.',
    inputSchema: object({ kind: str('privacy | cookies | terms | subprocessors | dpa'), locale: str('Locale you are drafting in.') }),
    handler: async (input, project) => {
      const state = await readProfileState(project.payload, project.options)
      if (!input.kind) return json({ kinds: Object.keys(CHECKLISTS), terminology: terminologyFor(input.locale) })
      const checklist = checklistFor(String(input.kind))
      if (!checklist) return { text: `No checklist for kind "${input.kind}".`, isError: true }
      const profile = state.profile
      const applicable = checklist.requirements.filter((requirement) => {
        const when = requirement.appliesWhen
        if (!when) return true
        if (when.audience && !when.audience.includes(String(profile.audience ?? ''))) return false
        if (when.role && !when.role.includes(String(profile.role ?? ''))) return false
        if (when.offersToEEA !== undefined && Boolean(profile.offersToEEA) !== when.offersToEEA) return false
        return true
      })
      return json({
        ...checklist,
        requirements: applicable,
        terminology: terminologyFor(input.locale),
        unanswered: state.missing.filter((q) => applicable.some((r) => r.needsInput?.includes(q.key))),
        note: NOT_LEGAL_ADVICE,
      })
    },
  },
  {
    name: 'consent_profile',
    description:
      'Read the compliance profile, or record answers to its questions. Facts like the controller’s legal name, the legal basis per purpose and retention periods must come from a human: ask them in this session, one at a time, repeating why the law needs each one, then record the answers here. Never fill these in yourself.',
    inputSchema: object({
      action: str('read (default) or record'),
      answers: {
        type: 'array',
        description: 'Answers to record, as {key, answer}. Keys come from the questions returned by a read.',
        items: object({ key: str('Question key'), answer: str('What the human said, in their words') }, ['key', 'answer']),
      },
      answeredBy: str('Who answered, for the provenance record.'),
    }),
    handler: async (input, project) => {
      if (input.action === 'record') {
        const answers = Array.isArray(input.answers) ? input.answers : []
        if (!answers.length) return { text: 'No answers given.', isError: true }
        const state = await recordProfileAnswers(project.payload, project.options, { answers, answeredBy: input.answeredBy })
        return json({ recorded: answers.map((a: { key: string }) => a.key), remaining: state.missing, complete: state.complete })
      }
      const state = await readProfileState(project.payload, project.options)
      return json({ profile: state.profile, missing: state.missing, complete: state.complete, allQuestions: PROFILE_QUESTIONS.map((q) => q.key) })
    },
  },
  {
    name: 'consent_propose',
    description:
      'Validate a markdown draft for a legal page and write it to .consent/proposals as a file. This does NOT touch the database. It is refused when the document depends on a legal fact nobody has answered — the refusal comes back with the questions to ask.',
    inputSchema: object(
      {
        slug: str('Page slug'),
        locale: str('Locale, when the site is localised'),
        kind: str('Page kind, required when creating'),
        create: bool('Create the page if it does not exist'),
        title: str('Page title, required when creating'),
        effectiveDate: str('ISO date for the new effective date'),
        markdown: str('The full page as markdown, with {{...}} tokens for generated tables'),
        rationale: str('Why this change is being made — a reviewer reads this'),
        addresses: { type: 'array', items: { type: 'string' }, description: 'Finding ids this draft fixes' },
      },
      ['slug', 'markdown', 'rationale'],
    ),
    handler: async (input, project) => {
      const proposal: Proposal = {
        version: 1,
        createdAt: new Date().toISOString(),
        generatedBy: { agent: process.env.PAYLOAD_CONSENT_AGENT, model: process.env.PAYLOAD_CONSENT_MODEL },
        page: { slug: String(input.slug), locale: input.locale, kind: input.kind },
        create: Boolean(input.create),
        title: input.title,
        effectiveDate: input.effectiveDate,
        markdown: String(input.markdown),
        rationale: String(input.rationale),
        addresses: input.addresses,
      }
      const validation = await validateProposal(project.payload, project.options, proposal)
      if (!validation.ok) return json({ ...validation, ok: false, askTheHuman: validation.needsInput })
      const file = writeProposal(project.root, proposal)
      return json({
        ok: true,
        file,
        warnings: validation.warnings,
        diff: validation.diff,
        next: 'Show the diff to the person. Nothing is written to the database until they run `payload-consent apply --allow-drafts`, and even then it lands as a draft version, never published.',
      })
    },
  },
  {
    name: 'consent_report',
    description:
      'Store the audit: the deterministic scan plus the findings you judged from the prose. Every inferred finding must quote the text it is about, or it is rejected. The stored audit is admin-only and is what non-developers read.',
    inputSchema: object({
      inferred: {
        type: 'array',
        description: 'Findings you formed by reading the pages.',
        items: object(
          {
            code: str('A finding code whose source is inferred, e.g. art13/missing-disclosure'),
            title: str('One line'),
            detail: str('What is wrong and why it matters'),
            quote: str('The text this is about — required'),
            severity: str('blocker | warn | info'),
            slug: str('Page slug'),
            locale: str('Locale'),
            confidence: { type: 'number', description: '0–1' },
            fix: str('What would resolve it'),
          },
          ['code', 'title', 'detail', 'quote'],
        ),
      },
      agent: str('Which agent produced the review'),
      model: str('Which model it was running'),
      label: str('Label for this run'),
    }),
    handler: async (input, project) => {
      const previous = await latestAudit(project.payload, project.options)
      const result = await runScan(project.payload, project.options, {
        root: project.root,
        previous: previous?.findings,
        toolVersion: toolVersion(),
      })
      const inferred: Finding[] = (Array.isArray(input.inferred) ? input.inferred : []).map((raw: Record<string, any>) => ({
        id: `${raw.code}#${Buffer.from(`${raw.slug ?? ''}|${raw.locale ?? ''}|${raw.title}`).toString('base64url').slice(0, 12)}`,
        code: String(raw.code),
        severity: (raw.severity ?? 'warn') as Finding['severity'],
        source: 'inferred',
        title: String(raw.title),
        detail: String(raw.detail),
        quote: raw.quote ? String(raw.quote) : undefined,
        evidence: raw.evidence ?? [],
        fix: raw.fix,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
        ...(raw.slug ? { page: { slug: String(raw.slug), kind: '', locale: raw.locale } } : {}),
        status: 'open' as const,
      }))
      const errors = validateInferred(inferred)
      if (errors.length) return json({ ok: false, errors, note: 'Nothing was stored. A model-judged finding must quote the text it judges.' })
      const saved = await saveAudit(project.payload, project.options, {
        result,
        inferred,
        agent: input.agent,
        model: input.model,
        label: input.label,
      })
      return json({
        ok: true,
        auditId: saved?.id ?? null,
        stored: saved ? 'The audit is in the admin under Legal audits, visible to admins only.' : 'The audits collection is disabled; nothing was stored.',
        counts: result.counts,
        inferredCount: inferred.length,
      })
    },
  },
  {
    name: 'consent_apply',
    description:
      'Apply proposals as DRAFT versions of the legal pages. Refused unless the server was started with --allow-drafts. Never publishes: a person reviews the draft in the admin and decides.',
    inputSchema: object({
      slug: str('Apply only the proposal for this slug'),
      dryRun: bool('Validate and diff without writing'),
    }),
    handler: async (input, project) => {
      const allowDrafts = process.env.PAYLOAD_CONSENT_ALLOW_DRAFTS === '1'
      const proposals = readProposals(project.root).filter((p) => !input.slug || p.page.slug === input.slug)
      if (!proposals.length) return { text: 'No proposals in .consent/proposals.', isError: true }
      const results = []
      for (const proposal of proposals) {
        results.push(await applyProposal(project.payload, project.options, proposal, { allowDrafts, dryRun: Boolean(input.dryRun) }))
      }
      return json({ allowDrafts, results })
    },
  },
]

function skillPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'SKILL.md')
}

export async function runMcpServer(opts: { allowDrafts?: boolean; root?: string } = {}): Promise<void> {
  captureStdout()
  if (opts.allowDrafts) process.env.PAYLOAD_CONSENT_ALLOW_DRAFTS = '1'

  let project: Project | null = null
  const ensure = async (): Promise<Project> => {
    if (!project) project = await loadProject({ root: opts.root })
    return project
  }

  const reply = (id: unknown, result: unknown) => send({ jsonrpc: '2.0', id, result })
  const fail = (id: unknown, code: number, message: string) => send({ jsonrpc: '2.0', id, error: { code, message } })

  const rl = createInterface({ input: process.stdin })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let message: { id?: unknown; method?: string; params?: Record<string, any> }
    try {
      message = JSON.parse(trimmed)
    } catch {
      continue
    }
    const { id, method, params } = message
    if (id === undefined) continue // notification

    try {
      switch (method) {
        case 'initialize':
          reply(id, {
            protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_FALLBACK,
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: 'payload-consent', version: toolVersion() },
            instructions:
              'Legal audit tools for a Payload project. Run consent_scan first and treat its findings as settled. Read the SKILL resource before judging any prose. Never invent a legal fact: consent_profile carries the questions to put to a human.',
          })
          break
        case 'ping':
          reply(id, {})
          break
        case 'tools/list':
          reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
          break
        case 'resources/list':
          reply(id, {
            resources: [
              {
                uri: 'payload-consent://skill',
                name: 'Payload Consent legal skill',
                description: 'The procedure and the rules: deterministic first, never invent legal facts, respect the language.',
                mimeType: 'text/markdown',
              },
            ],
          })
          break
        case 'resources/read': {
          const uri = String(params?.uri ?? '')
          if (uri !== 'payload-consent://skill') {
            fail(id, -32602, `unknown resource ${uri}`)
            break
          }
          reply(id, { contents: [{ uri, mimeType: 'text/markdown', text: readFileSync(skillPath(), 'utf8') }] })
          break
        }
        case 'prompts/list':
          reply(id, { prompts: [] })
          break
        case 'tools/call': {
          const tool = TOOLS.find((t) => t.name === params?.name)
          if (!tool) {
            fail(id, -32602, `unknown tool ${String(params?.name)}`)
            break
          }
          const result = await tool.handler((params?.arguments ?? {}) as Record<string, any>, await ensure())
          reply(id, { content: [{ type: 'text', text: result.text }], isError: Boolean(result.isError) })
          break
        }
        default:
          fail(id, -32601, `unknown method ${String(method)}`)
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (method === 'tools/call') reply(id, { content: [{ type: 'text', text: `Error: ${detail}` }], isError: true })
      else fail(id, -32603, detail)
    }
  }
}
