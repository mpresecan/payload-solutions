import type { Payload, PayloadRequest, TypedLocale } from 'payload'

import { countBySeverity, makeFinding, sortFindings } from './findings.js'
import { blockTokensIn, unresolvedTokensIn } from './markdown.js'
import { gatherProjectFacts } from './project.js'
import { readProfileState } from './profile.js'
import type { AnyDoc, ResolvedConsentPluginOptions } from '../types.js'
import type { Finding, PageRef, ProjectFacts, ScanResult } from './types.js'

export const EEA = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'EEA', 'EU',
])

/**
 * Placeholders the seeds leave behind. Conservative on purpose: a false positive costs a
 * reviewer a glance, a false negative ships "1 Main Street" to production.
 */
const PLACEHOLDERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[[A-Z][A-Z _]{2,}\]/, label: 'a bracketed placeholder' },
  { pattern: /\bTODO\b/i, label: 'a TODO' },
  { pattern: /\bLorem ipsum\b/i, label: 'lorem ipsum' },
  { pattern: /\byour[ _-]?(company|business|organisation|organization)\b/i, label: '"your company"' },
  { pattern: /\bexample\.(com|org|test)\b/i, label: 'an example.com address' },
  { pattern: /\bacme\b/i, label: 'the Acme sample company' },
  { pattern: /\bXXXX?\b/, label: 'an XXX placeholder' },
]

const REVIEW_NOTICE = /review before publishing/i

type LegalPage = {
  doc: AnyDoc
  ref: PageRef
  locale?: string
  text: string
  tokens: string[]
  unresolved: string[]
  published: boolean
}

/** Flattens a page's rich text to a single string so prose patterns can be matched cheaply. */
function contentText(content: unknown): string {
  const parts: string[] = []
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  visit((content as { root?: unknown } | null)?.root)
  return parts.join(' ')
}

async function loadPages(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  locales: string[],
  req?: PayloadRequest,
): Promise<LegalPage[]> {
  if (!options.legalPages) return []
  const pages: LegalPage[] = []
  const passes = locales.length ? locales : [undefined]
  for (const locale of passes) {
    const res = (await payload.find({
      collection: options.slugs.legalPages,
      depth: 0,
      limit: 200,
      pagination: false,
      overrideAccess: true,
      req,
      ...(locale ? { locale: locale as unknown as TypedLocale, fallbackLocale: false as unknown as TypedLocale } : {}),
    })) as unknown as { docs: AnyDoc[] }
    for (const doc of res.docs) {
      pages.push({
        doc,
        locale,
        ref: {
          id: doc.id as string | number,
          slug: String(doc.slug ?? ''),
          kind: String(doc.kind ?? 'other'),
          title: doc.title ? String(doc.title) : undefined,
          ...(locale ? { locale } : {}),
        },
        text: contentText(doc.content),
        tokens: blockTokensIn(doc.content),
        unresolved: unresolvedTokensIn(doc.content),
        published: doc._status !== 'draft',
      })
    }
  }
  return pages
}

export type ScanInput = {
  /** Project root used for dependency and environment detection. Defaults to `process.cwd()`. */
  root?: string
  /** Findings from a previous run whose acceptances should be carried forward. */
  previous?: Finding[]
  toolVersion?: string
  req?: PayloadRequest
}

/**
 * The deterministic half of the audit.
 *
 * Everything here is something code can prove: a token that never became a block, a processor
 * row nobody ticked, a locale with no translation, a dependency the register does not mention.
 * Nothing in this file guesses, and nothing in it needs a model — which is what makes the
 * model's half of the audit worth reading.
 */
export async function runScan(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  input: ScanInput = {},
): Promise<ScanResult> {
  const req = input.req
  const root = input.root ?? process.cwd()
  const common = { depth: 0, limit: 500, pagination: false as const, overrideAccess: true, req }
  const findings: Finding[] = []

  const project: ProjectFacts = gatherProjectFacts(payload, options, root)
  const profileState = await readProfileState(payload, options, req)
  const profile = profileState.profile

  const settings = (await payload.findGlobal({ slug: options.slugs.settings, depth: 0, overrideAccess: true, req })) as AnyDoc
  const categories = (await payload.find({ collection: options.slugs.categories, ...common })) as unknown as { docs: AnyDoc[] }
  const trackers = (await payload.find({ collection: options.slugs.trackers, ...common })) as unknown as { docs: AnyDoc[] }
  const processors = options.processors
    ? ((await payload.find({ collection: options.slugs.processors, ...common })) as unknown as { docs: AnyDoc[] })
    : { docs: [] as AnyDoc[] }
  const pages = await loadPages(payload, options, project.locales, req)

  // ---------------------------------------------------------------- profile
  for (const question of profileState.missing) {
    findings.push(
      makeFinding({
        code: 'profile/needs-input',
        subject: ['profile', question.key],
        severity: question.severity,
        title: `Unanswered: ${question.question}`,
        detail: question.why,
        evidence: [question.cite ? `${question.cite}` : 'compliance profile'],
        needsInput: [question.key],
        fix: 'Answer it in the terminal; the agent stores the answer on the compliance profile.',
      }),
    )
  }

  // ------------------------------------------------------------------ pages
  const byKind = new Map<string, LegalPage[]>()
  for (const page of pages) {
    if (!byKind.has(page.ref.kind)) byKind.set(page.ref.kind, [])
    byKind.get(page.ref.kind)!.push(page)
  }
  const publishedOf = (kind: string) => (byKind.get(kind) ?? []).filter((p) => p.published)

  const hasSubprocessorRows = processors.docs.some((d) => d.subprocessor && d.status === 'active')
  const isB2B = profile.audience === 'b2b' || profile.audience === 'both'
  const actsAsProcessor = profile.role === 'processor' || profile.role === 'both'

  if (options.legalPages) {
    const expected: Array<{ kind: string; label: string; required: boolean }> = [
      { kind: 'privacy', label: 'privacy policy', required: true },
      { kind: 'cookies', label: 'cookie policy', required: trackers.docs.some((t) => t.enabled) },
      { kind: 'terms', label: 'terms of service', required: false },
      { kind: 'subprocessors', label: 'sub-processor list', required: hasSubprocessorRows || isB2B },
      { kind: 'dpa', label: 'data processing agreement', required: actsAsProcessor || isB2B },
    ]
    for (const { kind, label, required } of expected) {
      if ((byKind.get(kind) ?? []).length === 0) {
        findings.push(
          makeFinding({
            code: 'pages/missing-kind',
            subject: ['kind', kind],
            severity: required ? 'blocker' : 'info',
            title: `No ${label}`,
            detail:
              kind === 'dpa'
                ? 'Business customers ask for a DPA before they sign; without one you are negotiating it per deal.'
                : `The project has no page of kind "${kind}".`,
            evidence: [`legal pages of kind "${kind}": 0`],
          }),
        )
      }
    }
  }

  const localeSet = project.locales
  const seenSlugLocales = new Map<string, Set<string>>()
  const tokensBySlug = new Map<string, Map<string, string[]>>()

  for (const page of pages) {
    const { ref } = page
    const where = `${ref.slug}${ref.locale ? ` (${ref.locale})` : ''}`

    if (ref.locale) {
      if (!seenSlugLocales.has(ref.slug)) seenSlugLocales.set(ref.slug, new Set())
      seenSlugLocales.get(ref.slug)!.add(ref.locale)
      if (!tokensBySlug.has(ref.slug)) tokensBySlug.set(ref.slug, new Map())
      tokensBySlug.get(ref.slug)!.set(ref.locale, page.tokens)
    }

    if (!page.published) {
      findings.push(
        makeFinding({
          code: 'pages/unpublished',
          subject: ['unpublished', ref.slug, ref.locale],
          detail: `"${ref.title ?? ref.slug}" has only ever been a draft, so visitors cannot read it.`,
          page: ref,
          evidence: [`${where}: _status = draft`],
        }),
      )
    }

    for (const token of page.unresolved) {
      findings.push(
        makeFinding({
          code: 'seed/unresolved-token',
          subject: ['token', ref.slug, ref.locale, token],
          detail: `The text ${token} is printed literally instead of rendering the block it names.`,
          page: ref,
          field: 'content',
          quote: token,
          evidence: [`${where}: literal token in the rich text`],
        }),
      )
    }

    for (const { pattern, label } of PLACEHOLDERS) {
      const match = pattern.exec(page.text)
      if (!match) continue
      if (label.includes('Acme') && profile.legalName && /acme/i.test(profile.legalName)) continue
      findings.push(
        makeFinding({
          code: 'seed/placeholder-text',
          subject: ['placeholder', ref.slug, ref.locale, label],
          detail: `The page still contains ${label}.`,
          page: ref,
          field: 'content',
          quote: match[0],
          evidence: [`${where}: matched ${pattern}`],
        }),
      )
    }

    if (REVIEW_NOTICE.test(page.text)) {
      findings.push(
        makeFinding({
          code: 'seed/review-banner',
          subject: ['review-notice', ref.slug, ref.locale],
          detail: 'The generated "review before publishing" notice is still in the published text.',
          page: ref,
          field: 'content',
          evidence: [`${where}: review notice present`],
        }),
      )
    }

    const effective = page.doc.effectiveDate ? new Date(String(page.doc.effectiveDate)) : null
    const updated = page.doc.updatedAt ? new Date(String(page.doc.updatedAt)) : null
    if (effective && updated && updated.getTime() - effective.getTime() > 36 * 60 * 60 * 1000) {
      findings.push(
        makeFinding({
          code: 'pages/stale-effective-date',
          subject: ['stale', ref.slug, ref.locale],
          detail: `Last edited ${updated.toISOString().slice(0, 10)}, but the effective date still says ${effective
            .toISOString()
            .slice(0, 10)}.`,
          page: ref,
          field: 'effectiveDate',
          evidence: [`${where}: updatedAt > effectiveDate`],
        }),
      )
    }
  }

  for (const [kind, group] of byKind) {
    const published = group.filter((p) => p.published)
    const perLocale = new Map<string, number>()
    for (const page of published) perLocale.set(page.ref.locale ?? '-', (perLocale.get(page.ref.locale ?? '-') ?? 0) + 1)
    for (const [locale, count] of perLocale) {
      if (count > 1) {
        findings.push(
          makeFinding({
            code: 'pages/duplicate-kind',
            subject: ['duplicate', kind, locale],
            detail: `${count} published pages of kind "${kind}"${locale === '-' ? '' : ` in ${locale}`}.`,
            evidence: published.filter((p) => (p.ref.locale ?? '-') === locale).map((p) => p.ref.slug),
          }),
        )
      }
    }
  }

  if (localeSet.length > 1) {
    for (const [slug, locales] of seenSlugLocales) {
      for (const locale of localeSet) {
        if (!locales.has(locale)) {
          findings.push(
            makeFinding({
              code: 'pages/missing-locale',
              subject: ['locale', slug, locale],
              detail: `"${slug}" has no ${locale} version, but ${locale} is a configured locale of this site.`,
              page: { slug, kind: byKind.get(slug)?.[0]?.ref.kind ?? 'other', locale },
              evidence: [`locales present: ${[...locales].join(', ')}`],
              fix: `Write the ${locale} version in ${locale}, using the official terminology of that language — not a literal translation of the English.`,
            }),
          )
        }
      }
      const tokenMap = tokensBySlug.get(slug)
      if (tokenMap && tokenMap.size > 1) {
        const signatures = new Map<string, string[]>()
        for (const [locale, tokens] of tokenMap) signatures.set(locale, [...tokens].sort())
        const distinct = new Set([...signatures.values()].map((t) => t.join('|')))
        if (distinct.size > 1) {
          findings.push(
            makeFinding({
              code: 'pages/locale-diverged',
              subject: ['diverged', slug],
              title: 'Translations of the same page render different tables',
              detail: `"${slug}" contains different generated blocks depending on the locale, so readers get different documents.`,
              page: { slug, kind: byKind.get(slug)?.[0]?.ref.kind ?? 'other' },
              evidence: [...signatures].map(([locale, tokens]) => `${locale}: ${tokens.join(', ') || 'no blocks'}`),
            }),
          )
        }
      }
    }
  }

  // ----------------------------------------------------------------- banner
  const banner = (settings.banner ?? {}) as Record<string, unknown>
  const jurisdiction = (settings.jurisdiction ?? {}) as Record<string, unknown>
  const overrides = Array.isArray(jurisdiction.overrides) ? (jurisdiction.overrides as Array<{ model?: string }>) : []
  const optInActive =
    String(jurisdiction.fallback ?? options.jurisdiction.fallback) === 'opt-in' ||
    overrides.some((o) => o.model === 'opt-in') ||
    options.jurisdiction.overrides.some((o) => o.model === 'opt-in')

  if (options.legalPages) {
    const linkChecks: Array<{ field: 'privacyPage' | 'cookiePage'; kind: string; label: string }> = [
      { field: 'privacyPage', kind: 'privacy', label: 'privacy policy' },
      { field: 'cookiePage', kind: 'cookies', label: 'cookie policy' },
    ]
    for (const { field, kind, label } of linkChecks) {
      const value = banner[field]
      if (!value) {
        findings.push(
          makeFinding({
            code: 'banner/missing-link',
            subject: ['banner-link', field],
            detail: `The banner has no link to the ${label}, so a visitor cannot read what they are agreeing to.`,
            field: `banner.${field}`,
            evidence: [`consent settings: banner.${field} is empty`],
          }),
        )
        continue
      }
      const id = typeof value === 'object' && value ? String((value as { id: unknown }).id) : String(value)
      const target = pages.find((p) => String(p.ref.id) === id)
      if (!target) {
        findings.push(
          makeFinding({
            code: 'banner/link-unpublished',
            subject: ['banner-target-missing', field],
            title: 'The banner links to a page that no longer exists',
            detail: `banner.${field} points at a ${label} that cannot be found.`,
            field: `banner.${field}`,
            evidence: [`referenced id: ${id}`],
          }),
        )
      } else if (!target.published) {
        findings.push(
          makeFinding({
            code: 'banner/link-unpublished',
            subject: ['banner-target-draft', field],
            detail: `banner.${field} points at "${target.ref.slug}", which is still a draft.`,
            page: target.ref,
            field: `banner.${field}`,
            evidence: [`${target.ref.slug}: _status = draft`],
          }),
        )
      } else if (target.ref.kind !== kind) {
        findings.push(
          makeFinding({
            code: 'banner/missing-link',
            subject: ['banner-kind', field],
            severity: 'warn',
            title: `The banner's ${label} link points at a different kind of page`,
            detail: `banner.${field} points at "${target.ref.slug}", which is of kind "${target.ref.kind}".`,
            page: target.ref,
            field: `banner.${field}`,
            evidence: [`expected kind "${kind}", found "${target.ref.kind}"`],
          }),
        )
      }
    }
  }

  if (optInActive && banner.showRejectAll === false) {
    findings.push(
      makeFinding({
        code: 'banner/reject-all-off',
        subject: ['reject-all'],
        detail:
          'Visitors under an opt-in model are shown a banner where accepting is easier than refusing, which regulators treat as invalid consent.',
        field: 'banner.showRejectAll',
        evidence: ['banner.showRejectAll = false', 'an opt-in jurisdiction is active'],
      }),
    )
  }

  const recordingMode = String((settings.recording as Record<string, unknown> | undefined)?.mode ?? options.recording.mode)
  if (optInActive && recordingMode === 'none') {
    findings.push(
      makeFinding({
        code: 'settings/recording-off-with-optin',
        subject: ['recording'],
        detail: 'Nothing is stored when a visitor decides, so there is no way to demonstrate that consent was given.',
        field: 'recording.mode',
        evidence: ['recording.mode = none', 'an opt-in jurisdiction is active'],
      }),
    )
  }

  // --------------------------------------------------------------- trackers
  const categoryIds = new Set(categories.docs.map((c) => String(c.id)))
  const enabledTrackers = trackers.docs.filter((t) => t.enabled !== false)
  for (const tracker of trackers.docs) {
    const categoryId = typeof tracker.category === 'object' && tracker.category ? String((tracker.category as { id: unknown }).id) : String(tracker.category ?? '')
    if (!categoryId || !categoryIds.has(categoryId)) {
      findings.push(
        makeFinding({
          code: 'trackers/uncategorised',
          subject: ['tracker-category', String(tracker.id)],
          detail: `"${String(tracker.name)}" has no valid category, so the banner will never load it and the cookie table will not list it.`,
          evidence: [`tracker ${String(tracker.name)}: category = ${categoryId || 'empty'}`],
        }),
      )
    }
    if (!tracker.purpose) {
      findings.push(
        makeFinding({
          code: 'trackers/missing-purpose',
          subject: ['tracker-purpose', String(tracker.id)],
          detail: `"${String(tracker.name)}" has no purpose, so the preferences dialog and cookie table have nothing to show.`,
          evidence: [`tracker ${String(tracker.name)}: purpose is empty`],
        }),
      )
    }
    for (const cookie of (Array.isArray(tracker.cookies) ? tracker.cookies : []) as Array<Record<string, unknown>>) {
      if (cookie.storage && cookie.storage !== 'cookie') continue
      if (!cookie.durationText) {
        findings.push(
          makeFinding({
            code: 'trackers/missing-duration',
            subject: ['cookie-duration', String(tracker.id), String(cookie.name)],
            detail: `Cookie "${String(cookie.name)}" (${String(tracker.name)}) has no duration, so the published table has a blank where a lifetime should be.`,
            evidence: [`tracker ${String(tracker.name)}: cookie ${String(cookie.name)} has no durationText`],
          }),
        )
      }
    }
  }

  const cookiePages = publishedOf('cookies')
  if (enabledTrackers.length && cookiePages.length && !cookiePages.some((p) => p.tokens.includes('{{cookie-table}}'))) {
    findings.push(
      makeFinding({
        code: 'trackers/no-cookie-table',
        subject: ['cookie-table'],
        detail: `${enabledTrackers.length} trackers are configured, but the cookie policy has no generated table, so the two can disagree.`,
        page: cookiePages[0].ref,
        field: 'content',
        evidence: [`enabled trackers: ${enabledTrackers.length}`, 'no cookieTable block on the cookie policy'],
      }),
    )
  }

  // ------------------------------------------------------------- processors
  if (options.processors) {
    const active = processors.docs.filter((d) => d.status !== 'removed')
    for (const row of active) {
      if (!row.verified) {
        findings.push(
          makeFinding({
            code: 'registry/unverified-processor',
            subject: ['unverified', String(row.id)],
            detail: `"${String(row.name)}" was seeded from a preset and nobody has confirmed the contracting entity or DPA link against the agreement you actually signed.`,
            evidence: [`processor ${String(row.name)}: verified = false`],
          }),
        )
      }
      const country = String(row.country ?? '').toUpperCase()
      const mechanism = String((row.transfer as Record<string, unknown> | undefined)?.mechanism ?? '')
      if (country && !EEA.has(country) && (!mechanism || mechanism === 'none')) {
        findings.push(
          makeFinding({
            code: 'registry/transfer-without-mechanism',
            subject: ['transfer', String(row.id)],
            detail: `"${String(row.name)}" processes in ${country} with no Chapter V safeguard recorded.`,
            evidence: [`processor ${String(row.name)}: country = ${country}, mechanism = ${mechanism || 'empty'}`],
          }),
        )
      }
    }

    const privacyPages = publishedOf('privacy')
    const disclosed = active.filter((d) => d.showInPrivacyPolicy !== false)
    if (disclosed.length && privacyPages.length && !privacyPages.some((p) => p.tokens.includes('{{processor-table:recipients}}'))) {
      findings.push(
        makeFinding({
          code: 'registry/no-recipients-table',
          subject: ['recipients-table'],
          detail: `${disclosed.length} recipients are in the register, but the privacy policy does not render them.`,
          page: privacyPages[0].ref,
          field: 'content',
          evidence: [`recipients: ${disclosed.length}`, 'no processorTable(recipients) block'],
        }),
      )
    }
    const transferring = active.filter((d) => {
      const country = String(d.country ?? '').toUpperCase()
      return country && !EEA.has(country)
    })
    if (transferring.length && privacyPages.length && !privacyPages.some((p) => p.tokens.includes('{{processor-table:transfers}}'))) {
      findings.push(
        makeFinding({
          code: 'registry/no-transfers-table',
          subject: ['transfers-table'],
          detail: `${transferring.length} recipients process outside the EEA, but the privacy policy renders no transfers table.`,
          page: privacyPages[0].ref,
          field: 'content',
          evidence: transferring.slice(0, 5).map((d) => `${String(d.name)} → ${String(d.country)}`),
        }),
      )
    }
    const subPages = publishedOf('subprocessors')
    if (hasSubprocessorRows && subPages.length && !subPages.some((p) => p.tokens.includes('{{processor-table:subprocessors}}'))) {
      findings.push(
        makeFinding({
          code: 'registry/no-subprocessor-table',
          subject: ['subprocessor-table'],
          detail: 'The sub-processor page does not render the register, so the published list can fall behind the real one.',
          page: subPages[0].ref,
          field: 'content',
          evidence: ['no processorTable(subprocessors) block'],
        }),
      )
    }
    const dpaPages = publishedOf('dpa')
    if (hasSubprocessorRows && dpaPages.length && !dpaPages.some((p) => p.tokens.includes('{{processor-table:annex}}'))) {
      findings.push(
        makeFinding({
          code: 'registry/no-annex',
          subject: ['annex-table'],
          detail: 'The DPA has no generated Annex III, so the annex and the published list can disagree.',
          page: dpaPages[0].ref,
          field: 'content',
          evidence: ['no processorTable(annex) block'],
        }),
      )
    }

    const known = new Set<string>()
    for (const row of active) {
      if (row.presetKey) known.add(String(row.presetKey).toLowerCase())
      known.add(String(row.name ?? '').toLowerCase())
    }
    for (const vendor of project.vendors) {
      const matched =
        (vendor.preset && known.has(vendor.preset.toLowerCase())) ||
        [...known].some((name) => name && (name.includes(vendor.name.toLowerCase().split(' ')[0]) || vendor.name.toLowerCase().includes(name)))
      if (!matched) {
        findings.push(
          makeFinding({
            code: 'registry/undisclosed-vendor',
            subject: ['vendor', vendor.preset ?? vendor.name],
            detail: `${vendor.name} is wired into this project but appears in no processor row, so it is in no recipients table and on no sub-processor list.`,
            evidence: [vendor.detail],
            fix: `Add ${vendor.name} to the processor register, or record that it never receives personal data.`,
          }),
        )
      }
    }

    const covered = new Set(active.flatMap((d) => (Array.isArray(d.dataCategories) ? (d.dataCategories as string[]) : [])))
    for (const category of project.categories) {
      if (covered.has(category)) continue
      const collections = project.collections.filter((c) => c.categories.includes(category)).map((c) => c.slug)
      findings.push(
        makeFinding({
          code: 'datamap/undisclosed-category',
          subject: ['datamap', category],
          severity: category === 'special' ? 'blocker' : 'info',
          title:
            category === 'special'
              ? 'The schema stores special category data'
              : `The schema stores "${category}" data that no recipient row mentions`,
          detail:
            category === 'special'
              ? `Fields in ${collections.join(', ')} look like special category data, which needs an Art. 9 condition on top of the Art. 6 basis.`
              : `Fields in ${collections.join(', ')} look like "${category}" data. Check the privacy policy describes it.`,
          evidence: project.collections
            .filter((c) => c.categories.includes(category))
            .flatMap((c) => c.fields.filter((f) => f.category === category).map((f) => `${c.slug}.${f.path} — ${f.reason}`))
            .slice(0, 6),
        }),
      )
    }
  }

  const merged = carryForward(sortFindings(findings), input.previous ?? [])
  return {
    scannedAt: new Date().toISOString(),
    toolVersion: input.toolVersion ?? 'unknown',
    project,
    profile: profileState,
    counts: countBySeverity(merged),
    findings: merged,
  }
}

/**
 * Acceptances survive a re-scan. A finding somebody accepted, with a reason, stays accepted
 * until it stops being raised — otherwise every run would ask the same question again and
 * people would learn to ignore the report.
 */
export function carryForward(findings: Finding[], previous: Finding[]): Finding[] {
  const decided = new Map(previous.filter((f) => f.status && f.status !== 'open').map((f) => [f.id, f]))
  return findings.map((finding) => {
    const before = decided.get(finding.id)
    if (!before) return finding
    return { ...finding, status: before.status, ...(before.reason ? { reason: before.reason } : {}) }
  })
}
