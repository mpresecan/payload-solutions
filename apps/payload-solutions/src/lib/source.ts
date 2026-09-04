import { loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'

/**
 * All product documentation lives in the monorepo's /docs directory (MDX) and is rendered at
 * payload.solutions/docs/*. Payload Stack, Payload Clock and every plugin link here.
 */
const docs = defineDocs({
  dir: '../../docs',
})

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})
