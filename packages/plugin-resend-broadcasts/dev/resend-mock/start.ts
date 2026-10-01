import type { ResendMock } from './mock.mjs'

import { createResendMock } from './mock.mjs'

const KEY = Symbol.for('plugin-resend-broadcasts.dev-mock')
type Holder = { mock: ResendMock; url?: Promise<string> }

/** Where the dev app mounts the mock (see `app/resend-mock/[...path]/route.ts`). */
export const MOCK_PREFIX = '/resend-mock'

/**
 * One in-memory Resend per process. The dev app serves it from its own Next route, so it lives in
 * the same server as Payload however Next spreads work across workers; the tests, which have no
 * HTTP server, start it on a random local port instead.
 */
export function getResendMock(): ResendMock {
  const store = globalThis as unknown as Record<symbol, Holder | undefined>
  store[KEY] ??= {
    mock: createResendMock({
      webhookSecret:
        process.env.RESEND_WEBHOOK_SECRET || 'whsec_ZGV2LXdlYmhvb2stc2VjcmV0LWZvci10aGUtbW9jaw==',
      webhookUrl: `${process.env.SERVER_URL || 'http://localhost:3500'}/api/resend-broadcasts/webhook`,
    }),
  }
  return store[KEY].mock
}

export function resendMockBaseUrl({
  isTest,
  serverURL,
}: {
  isTest: boolean
  serverURL: string
}): Promise<string> {
  if (!isTest) {
    return Promise.resolve(`${serverURL}${MOCK_PREFIX}`)
  }
  getResendMock()
  const holder = (globalThis as unknown as Record<symbol, Holder>)[KEY]
  holder.url ??= holder.mock.listen(0).then((server) => server.url)
  return holder.url
}
