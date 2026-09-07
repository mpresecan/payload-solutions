'use client'

import { usePathname } from 'next/navigation'
import { siGithub } from 'simple-icons'

import { BrandIcon } from '@/components/brand-icon'
import { sourceForPath } from '@/lib/docs-source'

/**
 * Pinned to the bottom of the docs sidebar: the source of whatever the select at the top is
 * showing. Payload Stack points at the template, a plugin at its package, and the overview
 * pages — like anything not written yet — at the repository.
 *
 * This replaces Fumadocs' own sidebar footer bar, which held a repo-wide GitHub icon and a
 * second theme switch; `layout.shared.tsx` drops `githubUrl` and disables `themeSwitch` so
 * that bar collapses. The theme control belongs in the site footer, one per page.
 *
 * The path is shown verbatim in mono rather than dressed up as "View source": the visitor is
 * being sent to a folder, and naming it is what tells them which one.
 */
export function DocsSourceLink() {
  const pathname = usePathname()
  const { path, url } = sourceForPath(pathname)

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      /* The rule above it is ours only on desktop: in the mobile drawer Fumadocs already
         draws a border over its own footer slot, and a second hairline reads as a mistake. */
      className="flex items-center gap-2.5 text-fd-muted-foreground transition-colors hover:text-fd-foreground md:mt-1 md:hairline-t md:pt-3"
    >
      <BrandIcon icon={siGithub} size={15} className="shrink-0" />
      <span className="truncate font-mono text-xs">{path ?? 'payload-solutions'}</span>
    </a>
  )
}
