import { llms } from 'fumadocs-core/source/llms'

import { source } from '@/lib/source'

/** A generated index of the published docs for coding agents and other LLM clients. */
export function GET() {
  return new Response(llms(source).index(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
