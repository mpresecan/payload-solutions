/**
 * Authentication through the real Better Auth instance payload-auth attaches to Payload: sign-up,
 * sign-in, sessions, password reset, password change, magic links, API keys, two-factor
 * enrolment, the admin plugin (roles, bans, user listing) and account deletion.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import stack from '@/stack.config'
import {
  PASSWORD,
  api,
  type AuthApi,
  anonymous,
  captureEmails,
  cookieHeader,
  expectApiError,
  firstUrl,
  getTestPayload,
  tokenFromUrl,
  makeAdmin,
  signIn,
  signUp,
  uniqueEmail,
  userDoc,
  withCookie,
  type TestPayload,
} from '../helpers/int'

let payload: TestPayload
let auth: AuthApi

beforeAll(async () => {
  payload = await getTestPayload()
  auth = api(payload)
})

describe('sign-up and sign-in', () => {
  it('creates a user with the default role and a session cookie', async () => {
    const actor = await signUp(payload, { name: 'Mira Lindqvist' })
    const doc = await userDoc(payload, actor)
    expect(doc.role).toEqual(['user'])
    expect(doc.onboardedAt).toBeNull()
    expect(actor.cookie).toMatch(/better-auth\.session_token=/)

    const session = await auth.getSession({ headers: actor.headers })
    expect(session?.user.email).toBe(actor.email)
    expect(session?.user.name).toBe('Mira Lindqvist')
    expect(session?.user.emailVerified).toBe(false)
  })

  it('rejects a duplicate email', async () => {
    const actor = await signUp(payload)
    await expectApiError(auth.signUpEmail({ body: { email: actor.email, name: 'Again', password: PASSWORD } }), /USER_ALREADY_EXISTS|already exists/i)
  })

  it('rejects short passwords', async () => {
    await expectApiError(auth.signUpEmail({ body: { email: uniqueEmail(), name: 'Short', password: 'short' } }), /PASSWORD_TOO_SHORT|too short/i)
  })

  it('signs in with the right password and refuses the wrong one or an unknown email', async () => {
    const actor = await signUp(payload)
    const again = await signIn(payload, actor.email)
    expect(again.id).toBe(actor.id)
    await expectApiError(auth.signInEmail({ body: { email: actor.email, password: 'Wrong-Passw0rd!' } }), /INVALID_EMAIL_OR_PASSWORD|invalid/i)
    await expectApiError(auth.signInEmail({ body: { email: uniqueEmail('nobody'), password: PASSWORD } }), /INVALID_EMAIL_OR_PASSWORD|invalid/i)
  })

  it('records the last used login method', async () => {
    const actor = await signUp(payload)
    expect(actor.cookie).toMatch(/better-auth\.last_used_login_method=email/)
  })

  it('sets a five-minute session cookie cache next to the session token', async () => {
    const { headers } = await auth.signInEmail({ body: { email: (await signUp(payload)).email, password: PASSWORD }, returnHeaders: true })
    const setCookies = headers.getSetCookie()
    const cache = setCookies.find((c: string) => c.startsWith('better-auth.session_data='))
    expect(cache).toMatch(/Max-Age=300/)
    expect(cookieHeader(headers, { cache: true })).toMatch(/session_data=/)
    expect(cookieHeader(headers)).not.toMatch(/session_data=/)
  })

  it('returns no session for a missing or garbage cookie', async () => {
    expect(await auth.getSession({ headers: new Headers() })).toBeNull()
    expect(await auth.getSession({ headers: withCookie('better-auth.session_token=nope') })).toBeNull()
  })
})

describe('sessions', () => {
  it('lists sessions, revokes one, and sign-out invalidates the cookie', async () => {
    const actor = await signUp(payload)
    const second = await signIn(payload, actor.email)
    const sessions = await auth.listSessions({ headers: actor.headers })
    expect(sessions.length).toBeGreaterThanOrEqual(2)

    const secondToken = /session_token=([^;]+)/.exec(second.cookie)![1]!
    await auth.revokeSession({ body: { token: decodeURIComponent(secondToken).split('.')[0]! }, headers: actor.headers })
    expect(await auth.getSession({ headers: second.headers })).toBeNull()

    await auth.signOut({ headers: actor.headers })
    expect(await auth.getSession({ headers: actor.headers })).toBeNull()
  })

  it('revokeOtherSessions keeps only the current one', async () => {
    const actor = await signUp(payload)
    const other = await signIn(payload, actor.email)
    await auth.revokeOtherSessions({ headers: actor.headers })
    expect(await auth.getSession({ headers: actor.headers })).not.toBeNull()
    expect(await auth.getSession({ headers: other.headers })).toBeNull()
  })
})

describe('profile', () => {
  it('updates the name and it shows in the session and in Payload', async () => {
    const actor = await signUp(payload)
    await auth.updateUser({ body: { name: 'Renamed Person' }, headers: actor.headers })
    const session = await auth.getSession({ headers: actor.headers })
    expect(session?.user.name).toBe('Renamed Person')
    const doc = (await payload.find({ collection: 'users', where: { email: { equals: actor.email } }, overrideAccess: true })).docs[0] as { name?: string }
    expect(doc.name).toBe('Renamed Person')
  })

  it('cannot write fields outside the allow-list through updateUser', async () => {
    const actor = await signUp(payload)
    await expectApiError(auth.updateUser({ body: { role: ['admin'] } as never, headers: actor.headers }), /.*/)
    expect((await userDoc(payload, actor)).role).toEqual(['user'])
  })
})

describe('passwords', () => {
  it('changes the password and the old one stops working', async () => {
    const actor = await signUp(payload)
    await auth.changePassword({
      body: { currentPassword: PASSWORD, newPassword: 'Another-Long-Passw0rd!', revokeOtherSessions: true },
      headers: actor.headers,
    })
    await expectApiError(auth.signInEmail({ body: { email: actor.email, password: PASSWORD } }), /INVALID/i)
    expect((await signIn(payload, actor.email, 'Another-Long-Passw0rd!')).id).toBe(actor.id)
  })

  it('refuses a change with the wrong current password', async () => {
    const actor = await signUp(payload)
    await expectApiError(
      auth.changePassword({ body: { currentPassword: 'Wrong-Passw0rd!', newPassword: 'Another-Long-Passw0rd!' }, headers: actor.headers }),
      /INVALID_PASSWORD|invalid/i,
    )
  })

  it('password reset: emails a link under the product url, the token resets the password, then sends a confirmation', async () => {
    const actor = await signUp(payload)
    const { sent, restore } = captureEmails(payload)
    try {
      await auth.requestPasswordReset({ body: { email: actor.email, redirectTo: '/auth/reset-password' } })
      expect(sent).toHaveLength(1)
      expect(sent[0]!.to).toBe(actor.email)
      expect(sent[0]!.subject).toBe(`Reset your ${stack.name} password`)
      const url = firstUrl(sent[0]!.text)
      expect(url.startsWith(stack.url)).toBe(true)
      const token = tokenFromUrl(url)
      expect(token).toBeTruthy()

      await auth.resetPassword({ body: { newPassword: 'Reset-Long-Passw0rd!', token } })
      expect(sent).toHaveLength(2)
      expect(sent[1]!.subject).toBe(`Your ${stack.name} password was changed`)
      expect((await signIn(payload, actor.email, 'Reset-Long-Passw0rd!')).id).toBe(actor.id)
      await expectApiError(auth.signInEmail({ body: { email: actor.email, password: PASSWORD } }), /INVALID/i)
    } finally {
      restore()
    }
  })

  it('password reset for an unknown email sends nothing and does not reveal anything', async () => {
    const { sent, restore } = captureEmails(payload)
    try {
      const result = await auth.requestPasswordReset({ body: { email: uniqueEmail('ghost'), redirectTo: '/auth/reset-password' } })
      expect(result.status).toBe(true)
      expect(sent).toHaveLength(0)
    } finally {
      restore()
    }
  })
})

describe('magic links', () => {
  it('emails a link whose token signs the user in', async () => {
    const actor = await signUp(payload)
    const { sent, restore } = captureEmails(payload)
    try {
      await auth.signInMagicLink({ body: { email: actor.email, callbackURL: '/dashboard' }, headers: anonymous() })
      expect(sent).toHaveLength(1)
      expect(sent[0]!.subject).toBe(`Your sign-in link for ${stack.name}`)
      const url = firstUrl(sent[0]!.text)
      const token = tokenFromUrl(url)
      const { headers } = await auth.magicLinkVerify({ query: { token }, headers: anonymous(), returnHeaders: true })
      const session = await auth.getSession({ headers: withCookie(cookieHeader(headers)) })
      expect(session?.user.id).toBe(actor.id)
      expect(cookieHeader(headers)).toMatch(/last_used_login_method=magic-link/)
    } finally {
      restore()
    }
  })

  it('creates the account for a new email when sign-up is open', async () => {
    const email = uniqueEmail('magic-new')
    const { sent, restore } = captureEmails(payload)
    try {
      await auth.signInMagicLink({ body: { email, name: 'Magic Person', callbackURL: '/dashboard' }, headers: anonymous() })
      const token = tokenFromUrl(firstUrl(sent[0]!.text))
      await auth.magicLinkVerify({ query: { token }, headers: anonymous() })
      const users = await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })
      expect(users.totalDocs).toBe(1)
    } finally {
      restore()
    }
  })

  it('rejects a bad token', async () => {
    await expectApiError(auth.magicLinkVerify({ query: { token: 'not-a-token' }, headers: anonymous() }), /.*/)
  })
})

describe('API keys', () => {
  it('creates a key that verifies, lists it without the secret, and deletes it', async () => {
    const actor = await signUp(payload)
    const created = await auth.createApiKey({ body: { name: 'ci' }, headers: actor.headers })
    expect(created.key).toBeTruthy()
    const verified = await auth.verifyApiKey({ body: { key: created.key } })
    expect(verified.valid).toBe(true)
    expect(String((verified.key as { referenceId?: string } | null)?.referenceId)).toBe(actor.id)

    const list = (await auth.listApiKeys({ headers: actor.headers })) as unknown as { apiKeys: Array<{ name: string | null }> }
    expect(list.apiKeys.map((k) => k.name)).toContain('ci')
    expect(JSON.stringify(list)).not.toContain(created.key)

    await auth.deleteApiKey({ body: { keyId: created.id }, headers: actor.headers })
    const gone = await auth.verifyApiKey({ body: { key: created.key } })
    expect(gone.valid).toBe(false)
  })
})

describe('two-factor', () => {
  it('enrolment requires the password and returns a TOTP uri with backup codes, without enabling yet', async () => {
    const actor = await signUp(payload)
    await expectApiError(auth.enableTwoFactor({ body: { password: 'Wrong-Passw0rd!' }, headers: actor.headers }), /INVALID_PASSWORD|invalid/i)
    const enrol = await auth.enableTwoFactor({ body: { password: PASSWORD }, headers: actor.headers })
    expect(enrol.totpURI).toMatch(new RegExp(`^otpauth://totp/${encodeURIComponent(stack.name)}`))
    expect(enrol.backupCodes.length).toBeGreaterThanOrEqual(8)
    const session = await auth.getSession({ headers: actor.headers })
    expect((session?.user as { twoFactorEnabled?: boolean }).twoFactorEnabled).toBe(false)
  })
})

describe('admin plugin', () => {
  it('regular users cannot list users or change roles', async () => {
    const actor = await signUp(payload)
    await expectApiError(auth.listUsers({ query: {}, headers: actor.headers }), /(?:403|FORBIDDEN|not allowed|permission)/i)
    await expectApiError(auth.banUser({ body: { userId: actor.id }, headers: actor.headers }), /(?:403|FORBIDDEN|not allowed|permission)/i)
  })

  it('site admins can list users, ban a user (who can no longer sign in) and unban', async () => {
    const admin = await signUp(payload, { name: 'Admin' })
    await makeAdmin(payload, admin)
    const victim = await signUp(payload)

    const list = await auth.listUsers({ query: { limit: 200 }, headers: admin.headers })
    expect(list.users.map((u: { email: string }) => u.email)).toContain(victim.email)

    await auth.banUser({ body: { userId: victim.id, banReason: 'test' }, headers: admin.headers })
    await expectApiError(auth.signInEmail({ body: { email: victim.email, password: PASSWORD } }), /BANNED|banned/i)
    expect(await auth.getSession({ headers: victim.headers })).toBeNull()

    await auth.unbanUser({ body: { userId: victim.id }, headers: admin.headers })
    expect((await signIn(payload, victim.email)).id).toBe(victim.id)
  })

  it('admins can impersonate a user and the impersonated session is marked', async () => {
    const admin = await signUp(payload, { name: 'Admin' })
    await makeAdmin(payload, admin)
    const target = await signUp(payload)
    const { headers } = await auth.impersonateUser({ body: { userId: target.id }, headers: admin.headers, returnHeaders: true })
    const session = await auth.getSession({ headers: withCookie(cookieHeader(headers)) })
    expect(session?.user.id).toBe(target.id)
    expect(String((session?.session as { impersonatedBy?: string | number }).impersonatedBy)).toBe(admin.id)
  })

  it('the role stored in Payload is what isAdmin reads', async () => {
    const admin = await signUp(payload)
    await makeAdmin(payload, admin)
    const { isAdmin } = await import('@/access')
    const doc = await userDoc(payload, admin)
    expect(isAdmin(doc as never)).toBe(true)
    const session = await auth.getSession({ headers: admin.headers })
    const { isSiteAdmin } = await import('@/lib/auth/session')
    expect(isSiteAdmin(session as never)).toBe(true)
  })
})

describe('account deletion', () => {
  it('sends a verification email whose token deletes the account and its sessions', async () => {
    const actor = await signUp(payload)
    const { sent, restore } = captureEmails(payload)
    try {
      await auth.deleteUser({ body: { password: PASSWORD, callbackURL: '/' }, headers: actor.headers })
      expect(sent).toHaveLength(1)
      expect(sent[0]!.subject).toBe(`Confirm deleting your ${stack.name} account`)
      const token = tokenFromUrl(firstUrl(sent[0]!.text))
      await auth.deleteUserCallback({ query: { token }, headers: actor.headers })
      const users = await payload.find({ collection: 'users', where: { email: { equals: actor.email } }, overrideAccess: true })
      expect(users.totalDocs).toBe(0)
      expect(await auth.getSession({ headers: actor.headers })).toBeNull()
    } finally {
      restore()
    }
  })
})
