/**
 * src/emails: every transactional email renders through one pipeline (React Email → Payload's
 * email adapter). A fake Payload records what would be sent so subject, recipient and the body
 * (link, product name, support address) can be asserted for each template, under two products.
 */
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { base } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

type Sent = { to: string; subject: string; html: string; text: string }

function fakePayload() {
  const sent: Sent[] = []
  const payload = { sendEmail: vi.fn(async (message: Sent) => void sent.push(message)) } as unknown as Payload
  return { payload, sent }
}

const url = 'https://test.example/auth/verify?token=abc123'
const to = 'person@example.test'

async function loadEmails(name = 'Test App') {
  return loadWithStack({ ...base, name, url: 'https://test.example', support: { email: 'help@test.example' } }, () => import('@/emails'))
}

describe('sendEmail pipeline', () => {
  it('renders html and plain text and hands both to payload.sendEmail', async () => {
    const { emails } = await loadEmails()
    const { payload, sent } = fakePayload()
    await emails.magicLink(payload, to, url)
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
    const [message] = sent
    expect(message!.to).toBe(to)
    expect(message!.html).toMatch(/<html/i)
    expect(message!.html).toContain(url)
    expect(message!.text).not.toMatch(/<[a-z]+>/i)
    expect(message!.text).toContain(url)
  })

  it('exposes shared defaults that name the product and hide the vendor footer', async () => {
    const { emailDefaults } = await loadWithStack({ ...base, name: 'Ridgeline' }, () => import('@/emails/send'))
    expect(emailDefaults).toEqual({ appName: 'Ridgeline', darkMode: false, poweredBy: false })
  })
})

describe('templates', () => {
  const cases: Array<{
    name: string
    send: (emails: Awaited<ReturnType<typeof loadEmails>>['emails'], payload: Payload) => Promise<void>
    subject: RegExp
    html: RegExp[]
  }> = [
    {
      name: 'verifyEmail',
      send: (e, p) => e.verifyEmail(p, to, url),
      subject: /^Verify your email for Ridgeline$/,
      html: [/verify/i, /abc123/],
    },
    {
      name: 'magicLink',
      send: (e, p) => e.magicLink(p, to, url),
      subject: /^Your sign-in link for Ridgeline$/,
      html: [/sign in/i, /5 minutes/i, /abc123/],
    },
    {
      name: 'resetPassword',
      send: (e, p) => e.resetPassword(p, to, url),
      subject: /^Reset your Ridgeline password$/,
      html: [/reset/i, /60 minutes|1 hour/i, /abc123/],
    },
    {
      name: 'passwordChanged',
      send: (e, p) => e.passwordChanged(p, to),
      subject: /^Your Ridgeline password was changed$/,
      html: [/password/i, /https:\/\/test\.example\/dashboard\/settings\/security/, /help@test\.example/],
    },
    {
      name: 'changeEmail',
      send: (e, p) => e.changeEmail(p, to, url, 'new@example.test'),
      subject: /^Confirm your new email for Ridgeline$/,
      html: [/new@example\.test/, /abc123/],
    },
    {
      name: 'deleteAccount',
      send: (e, p) => e.deleteAccount(p, to, url),
      subject: /^Confirm deleting your Ridgeline account$/,
      html: [/delet/i, /24 hours/i, /abc123/],
    },
    {
      name: 'organizationInvitation',
      send: (e, p) =>
        e.organizationInvitation(p, to, { url, inviterName: 'Mira', inviterEmail: 'mira@example.test', organizationName: 'Acme', role: 'admin' }),
      subject: /^Mira invited you to Acme on Ridgeline$/,
      html: [/Acme/, /Mira/, /admin/i, /48 hours/i, /abc123/],
    },
    {
      name: 'adminInvite',
      send: (e, p) => e.adminInvite(p, to, url),
      subject: /^You have been invited to administer Ridgeline$/,
      html: [/Ridgeline admin/, /72 hours/i, /abc123/],
    },
  ]

  it.each(cases.map((c) => [c.name, c] as const))('%s: subject, recipient and body', async (_name, c) => {
    const { emails } = await loadEmails('Ridgeline')
    const { payload, sent } = fakePayload()
    await c.send(emails, payload)
    expect(sent).toHaveLength(1)
    const [message] = sent
    expect(message!.to).toBe(to)
    expect(message!.subject).toMatch(c.subject)
    for (const pattern of c.html) expect(message!.html).toMatch(pattern)
    expect(message!.html).toContain('Ridgeline')
    expect(message!.html).not.toContain('Payload Stack')
  })

  it('covers every export of src/emails', async () => {
    const { emails } = await loadEmails()
    expect(Object.keys(emails).sort()).toEqual(cases.map((c) => c.name).sort())
  })

  it('falls back through inviter name, inviter email and "Someone" in the invitation subject', async () => {
    const { emails } = await loadEmails('Ridgeline')
    const { payload, sent } = fakePayload()
    await emails.organizationInvitation(payload, to, { url, inviterEmail: 'mira@example.test', organizationName: 'Acme' })
    await emails.organizationInvitation(payload, to, { url, organizationName: 'Acme' })
    expect(sent.map((m) => m.subject)).toEqual([
      'mira@example.test invited you to Acme on Ridgeline',
      'Someone invited you to Acme on Ridgeline',
    ])
  })

  it('propagates adapter failures instead of swallowing them', async () => {
    const { emails } = await loadEmails()
    const payload = { sendEmail: vi.fn(async () => { throw new Error('smtp down') }) } as unknown as Payload
    await expect(emails.magicLink(payload, to, url)).rejects.toThrow('smtp down')
  })
})
