import { createHmac, timingSafeEqual } from 'node:crypto'

/** HMAC-SHA1 hex digest of the raw body, the way Vercel signs webhooks and log drains. */
export function signVercelPayload(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha1', secret).update(rawBody).digest('hex')
}

/** Constant-time comparison of the `x-vercel-signature` header with the expected digest. */
export function verifyVercelSignature(
  rawBody: Buffer | string,
  headerSignature: null | string | undefined,
  secret: string,
): boolean {
  if (!headerSignature || !secret) {
    return false
  }
  const expected = signVercelPayload(rawBody, secret)
  const given = headerSignature.trim().toLowerCase()
  if (given.length !== expected.length) {
    return false
  }
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}
