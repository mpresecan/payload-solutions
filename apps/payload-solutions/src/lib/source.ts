import { loader } from 'fumadocs-core/source'
import type { Folder, Node } from 'fumadocs-core/page-tree'
import { defineDocs } from 'fumadocs-mdx/macro'

/**
 * All product documentation lives in the monorepo's /docs directory (MDX) and is rendered at
 * payload.solutions/docs/*. Payload Stack, Payload Clock and every plugin link here.
 */
const docs = defineDocs({
  dir: '../../docs',
})

const isRootFolder = (node: Node): node is Folder => node.type === 'folder' && Boolean(node.root)

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  pageTree: {
    transformers: [
      {
        /**
         * Every product and plugin folder is a Fumadocs root folder: the sidebar then shows one
         * of them at a time, with a select on top to switch. That select only offers root
         * folders that are siblings, so the plugins — which live under `plugins/` — are lifted
         * to the top of the page tree here, in place of the section they came from. Only the
         * tree changes; their URLs stay /docs/plugins/*.
         */
        root(node) {
          const children: Node[] = []

          for (const child of node.children) {
            if (child.type === 'folder' && !child.root && child.children.some(isRootFolder)) {
              if (child.index) children.push(child.index)
              children.push(...child.children)
              continue
            }

            children.push(child)
          }

          return { ...node, children }
        },
      },
    ],
  },
})
