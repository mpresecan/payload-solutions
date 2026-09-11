// Standalone mock Vercel for `pnpm dev`: `pnpm dev:mock-vercel` (port 3399, override with VERCEL_MOCK_PORT).
import { createMockVercel } from './mock.mjs'

const port = Number(process.env.VERCEL_MOCK_PORT ?? 3399)
const mock = createMockVercel({
  buildDelayMs: Number(process.env.VERCEL_MOCK_BUILD_DELAY_MS ?? 2000),
  buildTimeMs: Number(process.env.VERCEL_MOCK_BUILD_TIME_MS ?? 8000),
  log: true,
})
const base = await mock.listen(port)
console.log(`[vercel-mock] listening on ${base}`)
console.log(`[vercel-mock] hooks: ${base}/v1/integrations/deploy/prj_dev000000000000000000/hook_production (a hook id containing "fail" fails the build)`)
console.log(`[vercel-mock] simulate a git push: curl -X POST ${base}/__mock/external`)
