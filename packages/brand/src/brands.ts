/**
 * Brand registry. Everything that differs between the three sibling brands lives here;
 * everything that is the same (mark, tokens, layout) lives in the rest of this package.
 */

export type BrandId = 'solutions' | 'stack' | 'clock'

export interface Brand {
  id: BrandId
  /** Full display name, e.g. "Payload Stack". */
  name: string
  /** The word that follows "Payload" in the wordmark. */
  word: string
  domain: string
  url: string
  tagline: string
  description: string
  /** Where this product's documentation lives. All docs are hosted on payload.solutions. */
  docsUrl: string
  github: string
  /** Deep link to this product's own folder in the repo, when it has one. */
  githubSource?: string
  twitter?: string
}

/** Payload CMS itself. Every mention of the name in prose links here. */
export const PAYLOAD_URL = 'https://payloadcms.com'

export const SOLUTIONS_URL = 'https://payload.solutions'
export const DOCS_BASE_URL = `${SOLUTIONS_URL}/docs`
export const GITHUB_REPO_URL = 'https://github.com/mpresecan/payload-solutions'

/** The Payload Stack template itself, inside the monorepo. */
export const STACK_TEMPLATE_URL = `${GITHUB_REPO_URL}/tree/main/templates/payload-stack`

export const brands: Record<BrandId, Brand> = {
  solutions: {
    id: 'solutions',
    name: 'Payload Solutions',
    word: 'Solutions',
    domain: 'payload.solutions',
    url: SOLUTIONS_URL,
    tagline: 'Products, plugins and engineering for teams building on Payload CMS.',
    description:
      'Payload Solutions builds open-source products and plugins for the Payload CMS community, and builds custom SaaS on Payload CMS for clients.',
    docsUrl: DOCS_BASE_URL,
    github: GITHUB_REPO_URL,
  },
  stack: {
    id: 'stack',
    name: 'Payload Stack',
    word: 'Stack',
    domain: 'payloadstack.com',
    url: 'https://www.payloadstack.com',
    tagline: 'The SaaS boilerplate built on Payload CMS.',
    description:
      'Payload Stack is an open-source SaaS boilerplate on Payload CMS and Next.js: Better Auth, organizations, Stripe subscriptions, a shadcn dashboard and a Payload admin, scaffolded with one command.',
    docsUrl: `${DOCS_BASE_URL}/payload-stack`,
    github: GITHUB_REPO_URL,
    githubSource: STACK_TEMPLATE_URL,
  },
  clock: {
    id: 'clock',
    name: 'Payload Clock',
    word: 'Clock',
    domain: 'payloadclock.com',
    url: 'https://www.payloadclock.com',
    tagline: 'A reliable clock for serverless Payload jobs.',
    description:
      'Payload Clock triggers your Payload job queues on schedule so serverless deployments never miss a beat.',
    docsUrl: `${DOCS_BASE_URL}/payload-clock`,
    github: GITHUB_REPO_URL,
  },
}

/**
 * The shared mark: a box drawn as only its lid and its base. The walls are left out on purpose;
 * the eye supplies them. Built on the true isometric grid (30°) inside the 20 x 26 box the
 * previous mark used, so every consumer keeps its sizing:
 *
 * - `MARK_LID_PATH` is the lid, a rhombus (cube edge 10.3 units). It carries the brand colour.
 * - `MARK_BASE_PATH` is the base, the box's two lower front edges as one band (2.06 units deep,
 *   ends cut vertically in line with the implied walls). It takes `currentColor`.
 *
 * Keep packages/brand/assets/*.svg and each app's icon.svg in step with these.
 */
export const MARK_LID_PATH = 'M10 3.535L18.92 8.685L10 13.835L1.08 8.685Z'
export const MARK_BASE_PATH = 'M1.08 17.955L10 23.105L18.92 17.955V20.015L10 25.165L1.08 20.015Z'
/** The box the two paths actually fill, inside the 20 x 26 viewBox. */
export const MARK_INK = { x: 1.08, y: 3.535, w: 17.84, h: 21.63 }

/**
 * The colour of the mark's lid (historically "the facet") for each brand — the same values each
 * app's icon.svg favicon uses, so the logo on the page matches the tab. The base of the mark
 * stays `currentColor`; only the lid carries the brand.
 *
 * These are the favicon's contrast-stepped values, not the raw `--accent` tokens: Stack's
 * platinum #b4cee7 and Clock's brass #f0b84d merge into the near-white body at small sizes,
 * so both are cut a step deeper. Keep in step with each app's icon.svg.
 */
export const MARK_FACET_COLORS: Record<BrandId, string> = {
  solutions: '#5B9DFF',
  stack: '#6C8AA6',
  clock: '#C98A12',
}

/**
 * Required by Payload CMS, Inc. trademark guidelines (payloadcms.com/brand) for any use of the
 * Payload marks. Render this in every footer, verbatim.
 */
export const PAYLOAD_TRADEMARK_ATTRIBUTION =
  'Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries.'

export const INDEPENDENCE_NOTICE =
  'Payload Solutions is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Payload CMS, Inc.'

export const NPX_COMMAND = 'npx create-payload-stack@latest'

/**
 * Accent families defined in tokens.css. Every entity owns its own place in the set, so a
 * page never reads as "the orange one": Solutions is cobalt, Clock brass, Consent emerald,
 * Emails rose, Action Scheduler teal, Vercel Integration orchid, and Payload Stack a
 * near-neutral platinum that separates by saturation rather than hue. Wider than BrandId on
 * purpose — plugins get an accent without needing a full brand record (domain, tagline,
 * docs) they do not have.
 *
 * Adding an entity here without adding its block to tokens.css is the bug this set was
 * built to fix: an unmatched slug falls back to the umbrella cobalt and the entity silently
 * becomes indistinguishable from Payload Solutions.
 */
export type AccentId =
  | 'solutions'
  | 'stack'
  | 'clock'
  | 'consent'
  | 'emails'
  | 'scheduler'
  | 'vercel'

/**
 * The accent a product or plugin owns, from its slug or package name. Matched on the word
 * rather than an exact slug so `payload-consent`, `plugin-consent` and
 * `@payload-solutions/consent` all land on the same hue. Anything unrecognised falls back
 * to the umbrella cobalt.
 */
export function accentForSlug(slug?: string | null): AccentId {
  const s = (slug ?? '').toLowerCase()
  if (s.includes('stack')) return 'stack'
  if (s.includes('clock')) return 'clock'
  if (s.includes('consent')) return 'consent'
  if (s.includes('email')) return 'emails'
  if (s.includes('schedul')) return 'scheduler'
  if (s.includes('vercel')) return 'vercel'
  return 'solutions'
}

/**
 * The dark-theme value of each accent, as a literal colour. Anything that renders outside a
 * browser has no CSS variables and no `light-dark()` to resolve — the Open Graph images are
 * drawn by Satori, on the dark field, so they read their accent from here.
 *
 * Mirrors the dark side of each `[data-brand]` block in css/tokens.css and must be kept in
 * step with it. Typing it as `Record<AccentId, …>` is the guard: a new entity added to
 * `AccentId` will not compile until it has a colour here too.
 */
export const ACCENT_COLORS: Record<AccentId, { accent: string; glow: string }> = {
  solutions: { accent: '#5b9dff', glow: 'rgba(91, 157, 255, 0.16)' },
  stack: { accent: '#b4cee7', glow: 'rgba(180, 206, 231, 0.13)' },
  clock: { accent: '#f0b84d', glow: 'rgba(240, 184, 77, 0.14)' },
  consent: { accent: '#3dd98a', glow: 'rgba(61, 217, 138, 0.14)' },
  emails: { accent: '#ff7a8a', glow: 'rgba(255, 122, 138, 0.14)' },
  scheduler: { accent: '#3aced3', glow: 'rgba(58, 206, 211, 0.14)' },
  vercel: { accent: '#c175fc', glow: 'rgba(193, 117, 252, 0.16)' },
}
