import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { Field, Payload, SanitizedCollectionConfig } from 'payload'

import type { CollectionDataMap, DetectedVendor, PersonalDataField, ProjectFacts } from './types.js'
import type { ResolvedConsentPluginOptions } from '../types.js'

/**
 * Vendors inferred from the project. A dependency in `package.json` or a configured
 * environment variable is strong evidence that a recipient exists; whether it actually
 * receives personal data is a judgement, which is why these produce warnings and not blockers.
 */
const DEPENDENCY_VENDORS: Array<{ match: RegExp; preset?: string; name: string }> = [
  { match: /^stripe$|^@stripe\//, preset: 'stripe', name: 'Stripe' },
  { match: /^@paddle\//, preset: 'paddle', name: 'Paddle' },
  { match: /^@sentry\//, preset: 'sentry', name: 'Sentry' },
  { match: /^posthog-(js|node)$/, preset: 'posthog', name: 'PostHog' },
  { match: /^resend$/, preset: 'resend', name: 'Resend' },
  { match: /^postmark$/, preset: 'postmark', name: 'Postmark' },
  { match: /^@sendgrid\//, preset: 'sendgrid', name: 'SendGrid' },
  { match: /^@vercel\/(analytics|speed-insights|blob)$/, preset: 'vercel', name: 'Vercel' },
  { match: /^@payloadcms\/storage-vercel-blob$/, preset: 'vercel', name: 'Vercel' },
  { match: /^@aws-sdk\/client-s3$|^@payloadcms\/storage-s3$/, preset: 'aws', name: 'Amazon Web Services' },
  { match: /^@payloadcms\/storage-uploadthing$|^uploadthing$/, preset: 'uploadthing', name: 'UploadThing' },
  { match: /^cloudinary$|^@payloadcms\/storage-cloudinary$/, preset: 'cloudinary', name: 'Cloudinary' },
  { match: /^@neondatabase\//, preset: 'neon', name: 'Neon' },
  { match: /^@supabase\//, preset: 'supabase', name: 'Supabase' },
  { match: /^mongodb$|^@payloadcms\/db-mongodb$/, preset: 'mongodb-atlas', name: 'MongoDB' },
  { match: /^openai$/, preset: 'openai', name: 'OpenAI' },
  { match: /^@anthropic-ai\//, preset: 'anthropic', name: 'Anthropic' },
  { match: /^@slack\//, preset: 'slack', name: 'Slack' },
  { match: /^@intercom\/|^intercom-client$/, preset: 'intercom', name: 'Intercom' },
  { match: /^crisp-sdk-web$/, preset: 'crisp', name: 'Crisp' },
  { match: /^@microsoft\/clarity$/, name: 'Microsoft Clarity' },
  { match: /^@hotjar\//, name: 'Hotjar' },
  { match: /^@react-google-maps\/|^@googlemaps\//, name: 'Google Maps' },
  { match: /^@logtail\/|^@better-stack\//, preset: 'better-stack', name: 'Better Stack' },
  { match: /^@octokit\//, preset: 'github', name: 'GitHub' },
]

/**
 * Environment detections are keyed on the variable NAME and reported as the vendor. The name
 * itself is never stored or returned — a stored audit is not the place for an inventory of
 * someone's infrastructure, and the value is never read at all.
 *
 * Only the project's own `.env*` files are read, never `process.env`. The ambient environment
 * belongs to whoever is running the command: a developer with AWS credentials exported into
 * their shell would otherwise see Amazon appear as a recipient in their client's audit. The
 * cost is that variables set only in a hosting dashboard are invisible here, which is the
 * right way round — a missed detection is a warning that never fires, an ambient one is a
 * false accusation in a legal document.
 */
const ENV_VENDORS: Array<{ match: RegExp; preset?: string; name: string }> = [
  { match: /^STRIPE_/, preset: 'stripe', name: 'Stripe' },
  { match: /^PADDLE_/, preset: 'paddle', name: 'Paddle' },
  { match: /^SENTRY_/, preset: 'sentry', name: 'Sentry' },
  { match: /POSTHOG/, preset: 'posthog', name: 'PostHog' },
  { match: /^RESEND_/, preset: 'resend', name: 'Resend' },
  { match: /^POSTMARK_/, preset: 'postmark', name: 'Postmark' },
  { match: /^SENDGRID_/, preset: 'sendgrid', name: 'SendGrid' },
  { match: /^BLOB_READ_WRITE_TOKEN$|^VERCEL_/, preset: 'vercel', name: 'Vercel' },
  { match: /^(AWS|S3)_/, preset: 'aws', name: 'Amazon Web Services' },
  { match: /^R2_|^CLOUDFLARE_/, preset: 'cloudflare', name: 'Cloudflare' },
  { match: /^UPLOADTHING_/, preset: 'uploadthing', name: 'UploadThing' },
  { match: /^CLOUDINARY_/, preset: 'cloudinary', name: 'Cloudinary' },
  { match: /^OPENAI_/, preset: 'openai', name: 'OpenAI' },
  { match: /^ANTHROPIC_/, preset: 'anthropic', name: 'Anthropic' },
  { match: /^SLACK_/, preset: 'slack', name: 'Slack' },
  { match: /^GOOGLE_(CLIENT_ID|CLIENT_SECRET)$/, name: 'Google (social sign-in)' },
  { match: /^GITHUB_(CLIENT_ID|CLIENT_SECRET)$/, preset: 'github', name: 'GitHub (social sign-in)' },
  { match: /^(GA|NEXT_PUBLIC_GA)_?MEASUREMENT_ID$/, preset: 'ga4', name: 'Google Analytics' },
]

/**
 * Field-name heuristics for personal data. Deliberately conservative: a false positive costs
 * a reviewer thirty seconds, a false negative costs a disclosure.
 */
const FIELD_PATTERNS: Array<{ match: RegExp; category: string; reason: string }> = [
  { match: /^(email|e_?mail|emailAddress)$/i, category: 'contact', reason: 'email address' },
  { match: /(phone|mobile|telephone|tel)$/i, category: 'contact', reason: 'phone number' },
  { match: /^(address|street|city|postcode|postalCode|zip|country|region)$/i, category: 'contact', reason: 'postal address' },
  { match: /^(name|firstName|lastName|fullName|givenName|familyName|surname)$/i, category: 'contact', reason: 'name' },
  { match: /^(dob|dateOfBirth|birthday|birthDate)$/i, category: 'contact', reason: 'date of birth' },
  { match: /^(ip|ipAddress|remoteAddress)$/i, category: 'technical', reason: 'IP address' },
  { match: /^(userAgent|browser|device|fingerprint)$/i, category: 'technical', reason: 'device or browser data' },
  { match: /^(avatar|photo|picture|image|profileImage)$/i, category: 'content', reason: 'profile image' },
  { match: /^(company|organisation|organization|jobTitle|role)$/i, category: 'account', reason: 'workplace details' },
  { match: /^(vat|taxId|billingAddress|cardLast4|invoice)/i, category: 'billing', reason: 'billing details' },
  { match: /^(message|comment|note|body|content|bio|description)$/i, category: 'content', reason: 'free text a person can write about themselves' },
  { match: /^(health|medical|diagnosis|religion|ethnicity|politic|biometric|genetic|sexual)/i, category: 'special', reason: 'special category data' },
  { match: /^(marketingConsent|newsletter|subscribed|optIn)$/i, category: 'marketing', reason: 'marketing preference' },
]

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Variable names only. The file is parsed for keys and the values are discarded unread. */
export function envKeysFrom(root: string): string[] {
  const keys = new Set<string>()
  let entries: string[] = []
  try {
    entries = readdirSync(root)
  } catch {
    return []
  }
  for (const entry of entries) {
    if (!/^\.env($|\.)/.test(entry) || /\.example$|\.sample$/.test(entry)) continue
    let text = ''
    try {
      text = readFileSync(path.join(root, entry), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/.exec(line)
      if (match) keys.add(match[1])
    }
  }
  return [...keys]
}

export function detectVendors(root: string): DetectedVendor[] {
  const found = new Map<string, DetectedVendor>()
  const add = (vendor: DetectedVendor) => {
    const key = vendor.preset ?? vendor.name
    if (!found.has(key)) found.set(key, vendor)
  }

  const pkg = readJson(path.join(root, 'package.json'))
  const deps = {
    ...((pkg?.dependencies as Record<string, string>) ?? {}),
    ...((pkg?.devDependencies as Record<string, string>) ?? {}),
  }
  for (const dep of Object.keys(deps)) {
    for (const rule of DEPENDENCY_VENDORS) {
      if (rule.match.test(dep)) add({ preset: rule.preset, name: rule.name, via: 'dependency', detail: `the project depends on \`${dep}\`` })
    }
  }

  for (const key of envKeysFrom(root)) {
    for (const rule of ENV_VENDORS) {
      if (rule.match.test(key)) {
        add({ preset: rule.preset, name: rule.name, via: 'environment', detail: `${rule.name} is configured in this environment` })
      }
    }
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function walkFields(fields: Field[], prefix: string, out: PersonalDataField[]): void {
  for (const field of fields) {
    const named = 'name' in field && typeof field.name === 'string' ? field.name : undefined
    const at = named ? (prefix ? `${prefix}.${named}` : named) : prefix
    if (named && named !== 'password' && named !== 'salt' && named !== 'hash') {
      for (const rule of FIELD_PATTERNS) {
        if (rule.match.test(named)) {
          out.push({ path: at, category: rule.category, reason: rule.reason })
          break
        }
      }
    }
    if ('fields' in field && Array.isArray(field.fields)) walkFields(field.fields as Field[], at, out)
    if ('tabs' in field && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        const tabPrefix = 'name' in tab && typeof tab.name === 'string' ? (prefix ? `${prefix}.${tab.name}` : tab.name) : prefix
        walkFields(tab.fields as Field[], tabPrefix, out)
      }
    }
    if ('blocks' in field && Array.isArray(field.blocks)) {
      for (const block of field.blocks) {
        if (typeof block === 'object' && block && 'fields' in block) walkFields(block.fields as Field[], at, out)
      }
    }
  }
}

/**
 * Derives what personal data the application actually stores from the Payload schema, rather
 * than from a data map somebody maintains by hand and stops updating in month three.
 */
export function mapCollections(
  collections: SanitizedCollectionConfig[],
  options: ResolvedConsentPluginOptions,
): CollectionDataMap[] {
  const pluginOwned = new Set<string>([
    String(options.slugs.categories),
    String(options.slugs.trackers),
    String(options.slugs.legalPages),
    String(options.slugs.processors),
  ])
  return collections.map((collection) => {
    const fields: PersonalDataField[] = []
    walkFields(collection.fields as Field[], '', fields)
    const auth = Boolean(collection.auth)
    if (auth) fields.unshift({ path: 'id', category: 'account', reason: 'accounts sign in to this collection' })
    const upload = Boolean(collection.upload)
    const excluded =
      String(collection.slug) === String(options.slugs.records)
        ? 'consent records: real personal data, never included in audit evidence'
        : pluginOwned.has(String(collection.slug))
          ? 'managed by the consent plugin'
          : undefined
    return {
      slug: String(collection.slug),
      auth,
      upload,
      ...(excluded ? { excluded } : {}),
      fields: excluded ? [] : fields,
      categories: excluded ? [] : [...new Set(fields.map((f) => f.category))].sort(),
    }
  })
}

export function gatherProjectFacts(payload: Payload, options: ResolvedConsentPluginOptions, root: string): ProjectFacts {
  const pkg = existsSync(path.join(root, 'package.json')) ? readJson(path.join(root, 'package.json')) : null
  const localization = payload.config.localization
  const collections = mapCollections(payload.config.collections as SanitizedCollectionConfig[], options)
  return {
    root,
    packageName: typeof pkg?.name === 'string' ? pkg.name : undefined,
    vendors: detectVendors(root),
    collections,
    categories: [...new Set(collections.flatMap((c) => c.categories))].sort(),
    locales: localization ? localization.localeCodes.map(String) : [],
    defaultLocale: localization ? String(localization.defaultLocale) : undefined,
  }
}
