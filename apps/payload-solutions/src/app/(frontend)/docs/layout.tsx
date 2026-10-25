import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { getLayoutTabs, type LayoutTab } from 'fumadocs-ui/layouts/shared'
import type { ReactNode } from 'react'

import { DocsBrandSync } from '@/components/docs-brand-sync'
import { DocsSourceLink } from '@/components/docs-source-link'
import { SiteFooter } from '@/components/site-footer'
import { baseOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'

/** Pages that sit outside any product: the docs home and the plugin index. */
const OVERVIEW_URLS = ['/docs', '/docs/plugins']

/**
 * Fumadocs' own grid template (fumadocs-ui 16.15, layouts/docs/slots/container) plus one row:
 * `footer`, in the main column. The sidebar and TOC areas run down through that row, so both
 * stay beside the footer the way they stay beside every page: the footer closes the document,
 * not the shell. It cannot also take the TOC columns: Chrome keeps a sticky grid item inside
 * the whole grid, not its own rows, so the sticky TOC would ride over the footer.
 *
 * The footer is a grid item next to `<main>`, never inside it: a `<footer>` nested in `<main>`
 * loses its `contentinfo` role, and this is the page's only one. It comes after the page in
 * the DOM, so reading and tab order match what is seen.
 *
 * This replaces the library's inline template wholesale, so re-check it against
 * `slots/container.js` when bumping fumadocs-ui.
 */
const DOCS_GRID_TEMPLATE = `"sidebar sidebar header toc toc"
"sidebar sidebar toc-popover toc toc"
"sidebar sidebar main toc toc" 1fr
"sidebar sidebar footer toc toc" / minmax(min-content, 1fr) var(--fd-sidebar-col) minmax(0, calc(var(--fd-layout-width,97rem) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(min-content, 1fr)`

export default function Layout({ children }: { children: ReactNode }) {
  const tree = source.getPageTree()

  /**
   * One select at the top of the sidebar: every product and plugin (each a root folder in the
   * page tree), plus a way back to the overview. `urls` keeps the overview entry from matching
   * every /docs/* path, which a plain nested-url check would.
   */
  const tabs: LayoutTab[] = [
    ...getLayoutTabs(tree),
    {
      title: 'All documentation',
      description: 'Overview of products and plugins',
      url: '/docs',
      urls: new Set(OVERVIEW_URLS),
    },
  ]

  return (
    <>
      <DocsLayout
        {...baseOptions()}
        tree={tree}
        tabs={tabs}
        /*
          The sidebar's pinned foot: the source of the product the select is showing. The `key`
          is not decoration — Fumadocs drops this element into an array of sidebar children, and
          React warns about a keyless child owned by this file without it.
        */
        sidebar={{ footer: <DocsSourceLink key="docs-source" /> }}
        containerProps={{ style: { gridTemplate: DOCS_GRID_TEMPLATE } }}
      >
        <DocsBrandSync />
        {children}
        <SiteFooter className="docs-footer" />
      </DocsLayout>
    </>
  )
}
