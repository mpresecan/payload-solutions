import { toNextJsHandler } from 'better-auth/next-js'

import { getPayloadClient } from '@/lib/payload'

/**
 * Better Auth's HTTP API, served by the instance payload-auth attached to Payload.
 * The Stripe webhook also lands here: POST /api/auth/stripe/webhook.
 */
async function handler(request: Request) {
  const payload = await getPayloadClient()
  const { GET, POST } = toNextJsHandler(payload.betterAuth)
  return request.method === 'POST' ? POST(request) : GET(request)
}

export { handler as GET, handler as POST }
