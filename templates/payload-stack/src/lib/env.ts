/**
 * Server-side environment validation. Import `env` instead of touching process.env so a missing
 * variable fails loudly at boot with the variable's name, not deep inside a request.
 *
 * Only import this from server code (payload.config.ts, route handlers, server components).
 */
import { z } from 'zod'

const optionalString = z.string().min(1).optional()

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PAYLOAD_SECRET: z.string().min(1, 'PAYLOAD_SECRET is required'),
  /** Falls back to PAYLOAD_SECRET when unset. */
  BETTER_AUTH_SECRET: optionalString,

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Email (Resend). Without RESEND_API_KEY, Payload logs emails to the console in development.
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default('onboarding@resend.dev'),
  EMAIL_FROM_NAME: optionalString,

  // Billing (Stripe). Required only when stack.config.ts enables billing.
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,

  // Social sign-in. Required only for providers listed in stack.config.ts.
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  MICROSOFT_CLIENT_ID: optionalString,
  MICROSOFT_CLIENT_SECRET: optionalString,
  APPLE_CLIENT_ID: optionalString,
  APPLE_CLIENT_SECRET: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,
})

function load() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return parsed.data
}

export const env = load()

export type Env = z.output<typeof schema>

export function requireEnv<K extends keyof Env>(key: K, why: string): NonNullable<Env[K]> {
  const value = env[key]
  if (value === undefined || value === null || value === '') {
    throw new Error(`${String(key)} is required ${why}`)
  }
  return value as NonNullable<Env[K]>
}
