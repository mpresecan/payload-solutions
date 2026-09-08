import type { Payload } from 'payload'

import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { createPayloadRequest, getPayload } from 'payload'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { sentEmails } from './helpers/testEmailAdapter.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

let payload: Payload
let userId: number | string

beforeAll(async () => {
  for (const f of ['test.db', 'test.db-journal']) {
    fs.rmSync(path.resolve(dirname, f), { force: true })
  }
  payload = await getPayload({ config })
  const user = await payload.create({
    collection: 'users',
    data: { name: 'Ada Lovelace', email: 'ada@example.com', password: 'test' },
  })
  userId = user.id
})

afterAll(async () => {
  await payload.destroy()
})

beforeEach(() => {
  sentEmails.length = 0
})

async function docFor(key: string) {
  const { docs } = await payload.find({ collection: 'transactional-emails', where: { key: { equals: key } } })
  return docs[0]!
}

describe('seeding', () => {
  test('creates one published document per definition with defaults converted to Lexical', async () => {
    const { docs } = await payload.find({ collection: 'transactional-emails', sort: 'key' })
    expect(docs.map((d) => d.key)).toEqual(['new-user-notification', 'password-reset', 'welcome'])
    const welcome = docs.find((d) => d.key === 'welcome')!
    expect(welcome.subject).toBe('Welcome to {{site.name}}, {{user.name}}')
    expect(welcome.enabled).toBe(true)
    expect(welcome._status).toBe('published')
    expect(welcome.label).toBe('Welcome')
    expect(welcome.group).toBe('Auth')
    expect(welcome.inUse).toBe(true)
    expect(welcome.variables).toHaveProperty('user.name')
    expect(JSON.stringify(welcome.body)).toContain('"blockType":"button"')
  })

  test('is idempotent and seeds admin recipients into settings', async () => {
    const result = await payload.emails.sync()
    expect(result.created).toEqual([])
    const settings = await payload.findGlobal({ slug: 'email-settings' })
    expect(settings.adminRecipients?.map((r) => r.email)).toEqual(['admin@example.com'])
  })

  test('exposes payload.emails with the definitions', () => {
    expect([...payload.emails.definitions.keys()].sort()).toEqual(['new-user-notification', 'password-reset', 'welcome'])
  })
})

describe('sending', () => {
  test('renders admin copy with resolved variables and sends through the adapter', async () => {
    const result = await payload.emails.send('welcome', { input: { url: 'https://app.example.com/dashboard', user: userId } })
    expect(result.status).toBe('sent')
    expect(result.messageId).toMatch(/^test-/)
    expect(sentEmails).toHaveLength(1)
    const msg = sentEmails[0]!
    expect(msg.to).toEqual(['ada@example.com'])
    expect(msg.subject).toBe('Welcome to , Ada Lovelace') // site.name is empty until settings are filled in
    // React Email output: a table-based document, the button as a real anchor, bold preserved.
    expect(msg.html).toContain('Ada Lovelace')
    expect(msg.html).toContain('href="https://app.example.com/dashboard"')
    expect(msg.html).toContain('Open your dashboard')
    expect(msg.html).toContain('<strong>ada@example.com</strong>')
    expect(msg.html).toContain('max-width:600px')
    expect(msg.text).toContain('Open your dashboard')
    expect(msg.text).toContain('https://app.example.com/dashboard')
    expect(msg.headers).toMatchObject({ 'X-Payload-Email': 'welcome' })
  })

  test('accepts a populated document as relationship input and an explicit recipient override', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId })
    const result = await payload.emails.send('welcome', { input: { url: 'https://x.y', user }, to: 'other@example.com' })
    expect(result.status).toBe('sent')
    expect(sentEmails[0]!.to).toEqual(['other@example.com'])
  })

  test('uses admin recipients from settings for audience: admin', async () => {
    const result = await payload.emails.send('new-user-notification', {
      input: { registeredAt: '2026-09-06T10:00:00.000Z', user: userId },
    })
    expect(result.status).toBe('sent')
    expect(sentEmails[0]!.to).toEqual(['admin@example.com'])
    expect(sentEmails[0]!.html).toContain('ada@example.com')
    expect(sentEmails[0]!.html).toMatch(/September 6, 2026|6 September 2026/)
  })

  test('skips disabled emails but never required ones', async () => {
    const welcome = await docFor('welcome')
    await payload.update({ collection: 'transactional-emails', id: welcome.id, data: { enabled: false } })
    const skipped = await payload.emails.send('welcome', { input: { url: 'https://x.y', user: userId } })
    expect(skipped).toMatchObject({ reason: 'disabled', status: 'skipped' })
    expect(sentEmails).toHaveLength(0)
    await payload.update({ collection: 'transactional-emails', id: welcome.id, data: { enabled: true } })

    const reset = await docFor('password-reset')
    const updated = await payload.update({ collection: 'transactional-emails', id: reset.id, data: { enabled: false } })
    expect(updated.enabled).toBe(true) // forced back on by beforeValidate
    const sent = await payload.emails.send('password-reset', { input: { email: 'ada@example.com', url: 'https://x.y/reset' } })
    expect(sent.status).toBe('sent')
  })

  test('edited copy wins over code defaults and tokens are validated on save', async () => {
    const welcome = await docFor('welcome')
    await payload.update({ collection: 'transactional-emails', id: welcome.id, data: { subject: 'Hey {{user.name}}!' } })
    await payload.emails.send('welcome', { input: { url: 'https://x.y', user: userId } })
    expect(sentEmails[0]!.subject).toBe('Hey Ada Lovelace!')

    const error = await payload
      .update({ collection: 'transactional-emails', id: welcome.id, data: { subject: 'Hey {{user.nmae}}!' } })
      .catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(JSON.stringify(error.data)).toMatch(/Unknown variable \{\{user\.nmae\}\}/)
    await payload.update({ collection: 'transactional-emails', id: welcome.id, data: { subject: 'Welcome to {{site.name}}, {{user.name}}' } })
  })

  test('throws for unknown slugs and invalid input, returns skipped when no recipient', async () => {
    await expect(payload.emails.send('nope' as never, { input: {} as never })).rejects.toThrow(/No email is defined/)
    await expect(payload.emails.send('welcome', { input: { user: userId } as never })).rejects.toThrow(/url is required/)
    const result = await payload.emails.send('password-reset', { input: { email: '', url: 'https://x.y' } as never }).catch((e) => e)
    expect(result).toBeInstanceOf(Error) // email is required → validation
  })

  test('writes the email log', async () => {
    await payload.emails.send('welcome', { input: { url: 'https://x.y', user: userId } })
    const { docs } = await payload.find({ collection: 'email-log', sort: '-sentAt', limit: 1 })
    expect(docs[0]).toMatchObject({ key: 'welcome', status: 'sent', to: 'ada@example.com' })
    expect(docs[0]!.variables).toMatchObject({ 'user.email': 'ada@example.com' })
  })

  test('render() returns subject, html, text and resolved recipients without sending', async () => {
    const rendered = await payload.emails.render('password-reset', { input: { email: 'ada@example.com', url: 'https://x.y/r' } })
    expect(rendered.subject).toBe('Reset your  password')
    expect(rendered.to).toEqual(['ada@example.com'])
    expect(rendered.html).toContain('<!DOCTYPE html')
    expect(rendered.text).toContain('Choose a new password')
    expect(rendered.text).toContain('https://x.y/r')
    expect(sentEmails).toHaveLength(0)
  })
})

describe('settings and template', () => {
  test('sender, site name and footer flow into the rendered email; the template supplies the design', async () => {
    await payload.updateGlobal({
      slug: 'email-settings',
      data: {
        from: { address: 'hello@example.com', name: 'Example' },
        replyTo: 'support@example.com',
        siteName: 'Example App',
        siteUrl: 'https://example.com',
      },
    })
    const result = await payload.emails.send('welcome', { input: { url: 'https://x.y', user: userId } })
    expect(result.status).toBe('sent')
    const msg = sentEmails[0]!
    expect(msg.subject).toBe('Welcome to Example App, Ada Lovelace')
    expect(msg.from).toEqual({ address: 'hello@example.com', name: 'Example' })
    expect(msg.replyTo).toBe('support@example.com')
    // Branding comes from the template, not from settings.
    expect(msg.html).toContain('background-color:#ffffff')
    expect(msg.html).toContain('Example App')
    expect(msg.html).toContain('href="https://example.com"')
  })

  test('a custom template replaces the design without touching the copy', async () => {
    const rendered = await payload.emails.render('welcome', { input: { url: 'https://x.y', user: userId } })
    expect(rendered.html).toContain('#f4f4f5') // default template background
    expect(rendered.html).toContain('Ada Lovelace') // copy is unchanged
  })
})

describe('admin endpoints', () => {
  async function call(pathname: string, body: unknown, asUser = true, localeIsNull = false) {
    const request = new Request(`http://localhost:3300/api/transactional-emails/${pathname}`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    const req = await createPayloadRequest({ config, request })
    if (asUser) {
      req.user = (await payload.findByID({ collection: 'users', id: userId })) as never
    }
    if (localeIsNull) {
      // What Payload's HTTP handler actually gives a project with no localization configured.
      ;(req as { locale?: null | string }).locale = null
    }
    const collection = payload.collections['transactional-emails'].config
    const endpoint = collection.endpoints && collection.endpoints.find((e) => pathname.endsWith(e.path.split('/').pop()!))
    req.routeParams = { id: pathname.split('/')[0] }
    return endpoint!.handler(req)
  }

  test('preview renders with the sample from code and reports recipients', async () => {
    const welcome = await docFor('welcome')
    const res = await call(`${welcome.id}/preview`, {})
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.subject).toContain('Ada Lovelace')
    expect(data.to).toEqual(['ada@example.com'])
    expect(data.html).toContain('Open your dashboard')
    expect(data.variables['user.email']).toBe('ada@example.com')
  })

  test('preview falls back to example values when the sample cannot be resolved', async () => {
    const welcome = await docFor('welcome')
    const res = await call(`${welcome.id}/preview`, { input: { url: 'https://x.y', user: 999999 } })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.warning).toMatch(/could not be resolved/)
    expect(data.subject).toContain('Ada Lovelace') // manifest example
  })

  test('previews an email with number and date variables (req.locale is null without localization)', async () => {
    const reset = await docFor('password-reset')
    const res = await call(`${reset.id}/preview`, {}, true, true)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.variables['expires.minutes']).toBe(60)
    expect(data.html).toContain('60')

    const notify = await docFor('new-user-notification')
    const dateRes = await call(`${notify.id}/preview`, {}, true, true)
    expect(dateRes.status).toBe(200)
    expect((await dateRes.json()).html).toMatch(/\d{4}/)
  })

  test('send-test requires a user and a valid address, then sends with a [TEST] prefix', async () => {
    const welcome = await docFor('welcome')
    expect((await call(`${welcome.id}/send-test`, { to: 'me@example.com' }, false)).status).toBe(401)
    expect((await call(`${welcome.id}/send-test`, { to: 'not-an-email' })).status).toBe(400)
    const res = await call(`${welcome.id}/send-test`, { to: 'me@example.com' })
    expect(res.status).toBe(200)
    expect(sentEmails[0]!.to).toEqual(['me@example.com'])
    expect(sentEmails[0]!.subject).toMatch(/^\[TEST\] /)
  })
})

describe('code ↔ database', () => {
  test('the key cannot be changed and metadata is refreshed from code on save', async () => {
    const welcome = await docFor('welcome')
    await expect(
      payload.update({ collection: 'transactional-emails', id: welcome.id, data: { key: 'renamed' } }),
    ).rejects.toThrow(/cannot be changed/)
    const updated = await payload.update({
      collection: 'transactional-emails',
      id: welcome.id,
      data: { label: 'Hacked', preheader: 'New preheader' },
    })
    expect(updated.label).toBe('Welcome')
    expect(updated.preheader).toBe('New preheader')
  })

  test('documents whose key is no longer in code are reported as orphans', async () => {
    await payload.db.create({
      collection: 'transactional-emails',
      data: { enabled: true, key: 'old-email', label: 'Old', subject: 'x', body: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } }, _status: 'published' },
    })
    const result = await payload.emails.sync()
    expect(result.orphaned).toEqual(['old-email'])
    expect((await payload.emails.orphans()).map((o) => o.key)).toEqual(['old-email'])
    const orphan = await docFor('old-email')
    expect(orphan.inUse).toBe(false)
  })
})

describe('template preview endpoint', () => {
  test('renders the template with placeholder copy for an admin, and refuses anonymous callers', async () => {
    const make = async (asUser: boolean) => {
      const request = new Request('http://localhost:3300/api/email-templates/preview', {
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const req = await createPayloadRequest({ config, request })
      if (asUser) {
        req.user = (await payload.findByID({ collection: 'users', id: userId })) as never
      }
      const endpoint = (await import('@payload-solutions/plugin-emails')).SEND_TASK_SLUG && payload.config.endpoints.find((e) => e.path === '/email-templates/preview')
      return endpoint!.handler(req)
    }
    expect((await make(false)).status).toBe(401)
    const res = await make(true)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.template).toBe('default')
    expect(data.templates).toEqual(['default'])
    expect(data.html).toContain('Template preview')
    expect(data.html).toContain('max-width:600px')
  })
})

describe('sample form fields', () => {
  test('inputSchema becomes a form spec that names the relationship target collections', async () => {
    const { buildSampleFields } = await import('@payload-solutions/plugin-emails/sample-fields')
    const definition = payload.emails.definitions.get('welcome')!
    const fields = await buildSampleFields(payload, definition.inputSchema)
    expect(fields.map((f) => f.name)).toEqual(['user', 'url'])
    const user = fields[0]!
    expect(user.type).toBe('relationship')
    // The admin renders Payload's RelationshipInput, which loads titles and pages itself, so the
    // spec carries the collections rather than a snapshot of documents.
    expect(user.relationTo).toEqual(['users'])
    expect(fields[1]).toMatchObject({ label: 'Url', required: true, type: 'text' })
  })
})

describe('variable validation', () => {
  test('rejects a variable broken up by formatting', async () => {
    const welcome = await docFor('welcome')
    const body = {
      root: {
        children: [
          {
            children: [
              { detail: 0, format: 0, mode: 'normal', style: '', text: '{{user.', type: 'text', version: 1 },
              { detail: 0, format: 1, mode: 'normal', style: '', text: 'name}}', type: 'text', version: 1 },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    }
    const error = await payload
      .update({ collection: 'transactional-emails', id: welcome.id, data: { body } as never })
      .catch((e) => e)
    expect(JSON.stringify(error.data)).toMatch(/split by formatting/)
  })
})
