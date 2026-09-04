import 'server-only'

import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import type { Payload } from 'payload'

import stack from '@/stack.config'

/**
 * One pipeline for every transactional email: render a React Email template to HTML and hand it to
 * Payload's configured email adapter (Resend in production, console logging in development).
 *
 * Templates live in src/components/auth/email (from Better Auth UI) and can be previewed with
 * `pnpm email:dev`. Because sending goes through Payload, a plugin can later move the copy of these
 * emails into the admin panel without touching this code.
 */
export async function sendEmail(
  payload: Payload,
  {
    to,
    subject,
    react,
  }: {
    to: string
    subject: string
    react: ReactElement
  },
) {
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })])
  await payload.sendEmail({ to, subject, html, text })
}

/** Shared props every template accepts. */
export const emailDefaults = {
  appName: stack.name,
  darkMode: false,
  poweredBy: false,
} as const
