import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { getLayoutTabs, type LayoutTab } from 'fumadocs-ui/layouts/shared'
import type { ReactNode } from 'react'

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

  return (
    <DocsLayout {...baseOptions()} tree={tree} tabs={tabs}>
      {children}
    </DocsLayout>
  )
}
