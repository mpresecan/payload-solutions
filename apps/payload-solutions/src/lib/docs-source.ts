import { GITHUB_REPO_URL } from '@payload-solutions/brand'

/**
 * Where each documented thing lives in the monorepo, keyed by the URL of its docs root folder
 * — the same value the sidebar select navigates to, so a product's docs and its source can
 * never point at different things.
 *
 * Anything without an entry has no code in the repo yet (Payload Clock, and the plugins still
 * on the roadmap). Those fall back to the repository itself rather than linking to a path that
 * 404s, so the rule is: add the entry in the commit that adds the package.
 */
const SOURCE_PATHS: Record<string, string> = {
  '/docs/payload-stack': 'templates/payload-stack',
  '/docs/plugins/payload-consent': 'packages/plugin-consent',
}

export interface DocsSource {
  /** Path within the repo, or `null` when the link goes to the repository root. */
  path: string | null
  url: string
}

/**
 * The source location for a docs path. The longest matching root wins, so a plugin's own entry
 * beats the section it sits in.
 */
export function sourceForPath(pathname: string): DocsSource {
  const root = Object.keys(SOURCE_PATHS)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0]

  if (!root) return { path: null, url: GITHUB_REPO_URL }

  const path = SOURCE_PATHS[root]
  return { path, url: `${GITHUB_REPO_URL}/tree/main/${path}` }
}
