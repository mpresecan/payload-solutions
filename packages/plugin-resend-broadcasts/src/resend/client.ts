import { Resend } from 'resend'

/** A failed Resend call, with the API's own error name (`not_found`, `validation_error`, …). */
export class ResendApiError extends Error {
  readonly code: string
  readonly statusCode?: number

  constructor({
    code,
    message,
    statusCode,
  }: {
    code: string
    message: string
    statusCode?: number
  }) {
    super(`[plugin-resend-broadcasts] Resend: ${message}`)
    this.name = 'ResendApiError'
    this.code = code
    this.statusCode = statusCode
  }
}

export const isNotFound = (error: unknown): boolean =>
  error instanceof ResendApiError && (error.code === 'not_found' || error.statusCode === 404)

type SdkResult<T> = {
  data: null | T
  error: { message: string; name: string; statusCode?: null | number } | null
}

export type ResendClient = {
  /** Run one SDK call through the throttle, retrying rate limits, and unwrap `{ data, error }`. */
  call: <T>(label: string, fn: (resend: Resend) => Promise<SdkResult<T>>) => Promise<T>
  resend: Resend
}

const MAX_ATTEMPTS = 5

/**
 * Resend limits every team to a few requests per second (2 by default) and answers 429 beyond that,
 * so every call this process makes goes through one queue spaced `1000 / requestsPerSecond` ms apart.
 * Rate limits, 5xx responses and requests that never got an answer are retried with exponential
 * backoff; everything else is thrown as a `ResendApiError`.
 */
export function createResendClient({
  apiKey,
  baseUrl,
  requestsPerSecond = 2,
}: {
  apiKey?: string
  baseUrl?: string
  requestsPerSecond?: number
}): ResendClient {
  // The SDK throws on construction without a key; the plugin reports the missing key when it is used.
  const resend = new Resend(apiKey || 're_missing_api_key', baseUrl ? { baseUrl } : undefined)
  const spacing = requestsPerSecond > 0 ? Math.ceil(1000 / requestsPerSecond) : 0
  let nextSlot = 0

  const waitForSlot = async () => {
    const now = Date.now()
    const slot = Math.max(now, nextSlot)
    nextSlot = slot + spacing
    if (slot > now) {
      await new Promise((resolve) => setTimeout(resolve, slot - now))
    }
  }

  const call: ResendClient['call'] = async (label, fn) => {
    if (!apiKey) {
      throw new ResendApiError({
        code: 'missing_api_key',
        message: `${label}: no API key. Set RESEND_API_KEY or pass apiKey to resendBroadcastsPlugin().`,
      })
    }
    for (let attempt = 1; ; attempt++) {
      await waitForSlot()
      let result: SdkResult<unknown>
      try {
        result = await fn(resend)
      } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
          await backoff(attempt)
          continue
        }
        throw new ResendApiError({
          code: 'network_error',
          message: `${label}: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
      if (!result.error) {
        return result.data as never
      }
      const statusCode = result.error.statusCode ?? undefined
      // The SDK reports a request that never got an answer (DNS, reset, timeout) as an
      // `application_error` without a status code — transient, so it is retried like a 5xx.
      const isNetworkFailure = statusCode === undefined && result.error.name === 'application_error'
      const retryable =
        isNetworkFailure ||
        result.error.name === 'rate_limit_exceeded' ||
        statusCode === 429 ||
        (statusCode !== undefined && statusCode >= 500)
      if (retryable && attempt < MAX_ATTEMPTS) {
        await backoff(attempt)
        continue
      }
      throw new ResendApiError({
        code: result.error.name,
        message: `${label}: ${result.error.message}`,
        statusCode,
      })
    }
  }

  return { call, resend }
}

function backoff(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
}
