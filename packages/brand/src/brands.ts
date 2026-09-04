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
  twitter?: string
}

export const SOLUTIONS_URL = 'https://payload.solutions'
export const DOCS_BASE_URL = `${SOLUTIONS_URL}/docs`
export const GITHUB_REPO_URL = 'https://github.com/mpresecan/payload-solutions'

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
 * Required by Payload CMS, Inc. trademark guidelines (payloadcms.com/brand) for any use of the
 * Payload marks. Render this in every footer, verbatim.
 */
export const PAYLOAD_TRADEMARK_ATTRIBUTION =
  'Payload, the Payload design, and related marks, designs, and logos are trademarks or registered trademarks of Payload CMS, Inc. in the U.S. and other countries.'

export const INDEPENDENCE_NOTICE =
  'Payload Solutions is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Payload CMS, Inc.'

export const NPX_COMMAND = 'npx create-payload-stack@latest'
