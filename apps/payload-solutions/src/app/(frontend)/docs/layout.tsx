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

  /*
    The footer sits outside DocsLayout, not inside it. DocsLayout's container is a CSS grid
    whose sidebar and TOC columns own the full height, so a footer placed among its children
    would be boxed into the `main` column. As a sibling it closes the page edge to edge under
    the whole shell — the same move payloadcms.com makes on its docs pages, where the docs
    grid stops on a hairline and the site footer runs full width beneath it.
  */
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
      >
        <DocsBrandSync />
        {children}
      </DocsLayout>
      <SiteFooter />
    </>
  )
}
