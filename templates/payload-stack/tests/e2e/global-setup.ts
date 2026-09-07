/**
 * Runs once before the Playwright journeys. Creates (or reuses) a site admin through Better Auth's
 * HTTP API and promotes it with Payload's local API, then hands the credentials to the tests via
 * environment variables (Playwright forwards process.env changes made here to its workers).
 *
 * The dev server (see playwright.config.ts `webServer`) must be reachable, and DATABASE_URL must
 * point at the same database it uses: the sign-up below goes over HTTP to that server, while the
 * promotion goes straight to the database from here.
 */
import { e2eBaseUrl, loadTestEnv } from '../helpers/test-env'

loadTestEnv('e2e')

const base = e2eBaseUrl()
const email = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.test'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'Admin-Long-Passw0rd!'

async function waitForServer(url: string, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status < 500) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Dev server at ${url} did not come up`)
}

export default async function globalSetup() {
  await waitForServer(`${base}/api/auth/ok`)

  const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email, password, name: 'E2E Admin' }),
  })
  if (!signUp.ok) {
    const text = await signUp.text()
    if (!/USER_ALREADY_EXISTS|already exists/i.test(text)) throw new Error(`Could not create the e2e admin: ${signUp.status} ${text}`)
  }

  // Promote through Payload's local API (the way an operator would from the admin panel or a
  // migration). `getPayload` reuses the schema the dev server already pushed.
  const { getPayload } = await import('payload')
  const { default: config } = await import('@/payload.config')
  const payload = await getPayload({ config })
  const users = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
  const admin = users.docs[0]
  if (!admin) {
    // The sign-up succeeded over HTTP but the user is not in the database we just queried, so the
    // server on `base` is talking to a different one. Almost always another project's dev server
    // occupying the port.
    throw new Error(
      `Signed ${email} up at ${base}, but that user is not in DATABASE_URL (${process.env.DATABASE_URL}).\n` +
        `The server on ${base} is using a different database - it is probably another app.\n` +
        `Stop whatever listens on that port, or set E2E_PORT in test.env to a free one.`,
    )
  }
  await payload.update({ collection: 'users', id: admin.id, data: { role: ['admin'], emailVerified: true } as never, overrideAccess: true })
  if (typeof payload.db.destroy === 'function') await payload.db.destroy()

  process.env.E2E_ADMIN_EMAIL = email
  process.env.E2E_ADMIN_PASSWORD = password
}
