import type { Endpoint, Payload } from 'payload'

import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { createPayloadRequest, getPayload } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { signWebhook } from './resend-mock/mock.mjs'
import { getResendMock } from './resend-mock/start.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const SECRET = 'whsec_ZGV2LXdlYmhvb2stc2VjcmV0LWZvci10aGUtbW9jaw=='

let payload: Payload
let userId: number | string

const mock = () => getResendMock()
/** React Email separates adjacent text nodes with `<!-- -->`. */
const html = (value: string) => value.replaceAll('<!-- -->', '')
const contact = (email: string) => mock().state.contacts.get(email)
const segmentMembers = (segmentId: string) =>
  [...(mock().state.segments.get(segmentId)?.members ?? [])].sort()

async function body(markdown: string) {
  const { markdownToLexical } = await import('@payload-solutions/plugin-resend-broadcasts')
  return (await markdownToLexical(payload.config, markdown)) as never
}

async function subscriber(data: Record<string, unknown>) {
  return payload.create({ collection: 'subscribers', data: data as never })
}

async function list(data: Record<string, unknown>) {
  const doc = await payload.create({ collection: 'newsletter-lists', data: data as never })
  await payload.resendBroadcasts.idle()
  return payload.findByID({ id: doc.id, collection: 'newsletter-lists' })
}

async function call(
  collection: string,
  pathname: string,
  init: { body?: unknown; method?: string } = {},
) {
  const method = init.method ?? 'POST'
  const request = new Request(`http://localhost:3500/api/${collection}/${pathname}`, {
    body: method === 'GET' ? undefined : JSON.stringify(init.body ?? {}),
    headers: { 'Content-Type': 'application/json' },
    method,
  })
  const req = await createPayloadRequest({ config, request })
  req.user = {
    ...(await payload.findByID({ id: userId, collection: 'users' })),
    collection: 'users',
  } as never
  const endpoints = payload.collections[collection as 'users'].config.endpoints as Endpoint[]
  const [id, ...rest] = pathname.split('?')[0].split('/')
  const endpoint = endpoints.find(
    (e) => e.path === `/:id/${rest.join('/')}` && e.method === method.toLowerCase(),
  )!
  req.routeParams = { id }
  return endpoint.handler(req)
}

async function webhook(event: unknown, secret = SECRET) {
  const raw = JSON.stringify(event)
  const request = new Request('http://localhost:3500/api/resend-broadcasts/webhook', {
    body: raw,
    headers: { 'Content-Type': 'application/json', ...signWebhook(secret, raw) },
    method: 'POST',
  })
  const req = await createPayloadRequest({ config, request })
  const endpoint = payload.config.endpoints.find((e) => e.path === '/resend-broadcasts/webhook')!
  return endpoint.handler(req)
}

beforeAll(async () => {
  for (const f of ['test.db', 'test.db-journal']) {
    fs.rmSync(path.resolve(dirname, f), { force: true })
  }
  payload = await getPayload({ config })
  const user = await payload.create({
    collection: 'users',
    data: { name: 'Dev User', email: 'dev@payloadcms.com', password: 'test' },
  })
  userId = user.id
  await payload.updateGlobal({ slug: 'newsletter-settings', data: { siteName: 'Acme Weekly' } })
})

afterAll(async () => {
  await payload.resendBroadcasts.idle()
  await payload.destroy()
})

beforeEach(async () => {
  await payload.resendBroadcasts.idle()
  for (const slug of [
    'newsletter-campaigns',
    'newsletter-lists',
    'subscribers',
    'media',
  ] as const) {
    await payload.delete({ collection: slug, where: { id: { exists: true } } })
  }
  await payload.resendBroadcasts.idle()
  mock().reset()
})

describe('sources', () => {
  test('should add email, name and subscribed to a collection that lacks them', () => {
    const names = payload.collections.subscribers.config.flattenedFields.map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['email', 'name', 'subscribed']))
    const subscribed = payload.collections.subscribers.config.flattenedFields.find(
      (f) => f.name === 'subscribed',
    )
    expect(subscribed).toMatchObject({ type: 'checkbox', defaultValue: true })
  })

  test('should keep an auth collection’s own email and name and only add subscribed', () => {
    const fields = payload.collections.users.config.flattenedFields.filter((f) =>
      ['email', 'name', 'subscribed'].includes(f.name),
    )
    expect(fields.map((f) => f.name).sort()).toEqual(['email', 'name', 'subscribed'])
    expect(fields.find((f) => f.name === 'subscribed')).toMatchObject({ defaultValue: false })
  })
})

describe('contact sync', () => {
  test('should create a contact with the split name, full name and properties when a subscriber is saved', async () => {
    await subscriber({
      name: 'Ada King Lovelace',
      company: 'Analytical Engines',
      email: 'Ada@Example.com',
      plan: 'pro',
    })

    expect(contact('ada@example.com')).toMatchObject({
      first_name: 'Ada',
      last_name: 'King Lovelace',
      properties: { company: 'Analytical Engines', full_name: 'Ada King Lovelace', plan: 'pro' },
      unsubscribed: false,
    })
    expect([...mock().state.properties.keys()].sort()).toEqual(['company', 'full_name', 'plan'])
  })

  test('should not create a contact for someone who never subscribed', async () => {
    await subscriber({ name: 'No Thanks', email: 'nope@example.com', subscribed: false })

    expect(contact('nope@example.com')).toBeUndefined()
  })

  test('should mark the contact unsubscribed, not delete it, when the checkbox is cleared', async () => {
    const doc = await subscriber({ name: 'Grace Hopper', email: 'grace@example.com' })
    await payload.update({ id: doc.id, collection: 'subscribers', data: { subscribed: false } })

    expect(contact('grace@example.com')).toMatchObject({ unsubscribed: true })
  })

  test('should strip markup from values, because Resend inserts them unescaped', async () => {
    await subscriber({ name: '<b>Eve</b> Evil', email: 'x@example.com' })

    expect(contact('x@example.com')).toMatchObject({
      first_name: 'bEve/b',
      properties: { full_name: 'bEve/b Evil' },
    })
  })

  test('should move the contact and its segments when the email changes', async () => {
    const everyone = await list({ name: 'Everyone', source: 'subscribers' })
    const doc = await subscriber({ name: 'Old Address', email: 'old@example.com' })
    await payload.update({
      id: doc.id,
      collection: 'subscribers',
      data: { email: 'new@example.com' },
    })

    expect(contact('old@example.com')).toBeUndefined()
    expect(contact('new@example.com')).toBeDefined()
    expect(segmentMembers(everyone.segmentId!)).toEqual(['new@example.com'])
  })

  test('should delete the contact with its last document, but keep it while another source still has the address', async () => {
    const doc = await subscriber({ name: 'Shared Address', email: 'dev@payloadcms.com' })
    await payload.delete({ id: doc.id, collection: 'subscribers' })
    expect(contact('dev@payloadcms.com')).toBeDefined()

    const solo = await subscriber({ name: 'Solo', email: 'solo@example.com' })
    await payload.delete({ id: solo.id, collection: 'subscribers' })
    expect(contact('solo@example.com')).toBeUndefined()
  })
})

describe('lists and segments', () => {
  test('should create a segment for a new list and fill it from the filter', async () => {
    await subscriber({ name: 'A', email: 'a@example.com', plan: 'pro' })
    await subscriber({ name: 'B', email: 'b@example.com', plan: 'free' })
    await subscriber({ name: 'C', email: 'c@example.com', plan: 'pro', subscribed: false })

    const pro = await list({
      name: 'Pro',
      filter: { plan: { equals: 'pro' } },
      source: 'subscribers',
    })

    expect(mock().state.segments.get(pro.segmentId!)?.name).toBe('Pro')
    // c never subscribed, so there is no contact to put in the segment.
    expect(segmentMembers(pro.segmentId!)).toEqual(['a@example.com'])
    expect(pro.memberCount).toBe(1)
    expect(pro.lastSyncedAt).toBeTruthy()
  })

  test('should move a subscriber between segments when a filtered field changes', async () => {
    const pro = await list({
      name: 'Pro',
      filter: { plan: { equals: 'pro' } },
      source: 'subscribers',
    })
    const doc = await subscriber({ name: 'Upgrader', email: 'up@example.com', plan: 'free' })
    expect(segmentMembers(pro.segmentId!)).toEqual([])

    await payload.update({ id: doc.id, collection: 'subscribers', data: { plan: 'pro' } })
    expect(segmentMembers(pro.segmentId!)).toEqual(['up@example.com'])

    await payload.update({ id: doc.id, collection: 'subscribers', data: { plan: 'free' } })
    expect(segmentMembers(pro.segmentId!)).toEqual([])
  })

  test('should rebuild the segment when the filter changes, and rename and delete it with the list', async () => {
    await subscriber({ name: 'A', email: 'a@example.com', plan: 'pro' })
    await subscriber({ name: 'B', email: 'b@example.com', plan: 'free' })
    const l = await list({
      name: 'Some',
      filter: { plan: { equals: 'pro' } },
      source: 'subscribers',
    })

    await payload.update({
      id: l.id,
      collection: 'newsletter-lists',
      data: { name: 'Free', filter: { plan: { equals: 'free' } } },
    })
    await payload.resendBroadcasts.idle()
    expect(segmentMembers(l.segmentId!)).toEqual(['b@example.com'])
    expect(mock().state.segments.get(l.segmentId!)?.name).toBe('Free')

    await payload.delete({ id: l.id, collection: 'newsletter-lists' })
    expect(mock().state.segments.has(l.segmentId!)).toBe(false)
  })

  test('should reject a filter that does not run against the source', async () => {
    await expect(
      payload.create({
        collection: 'newsletter-lists',
        data: { name: 'Bad', filter: { nope: { equals: 1 } }, source: 'subscribers' },
      }),
    ).rejects.toThrow(/filter/i)
  })

  test('should list and search a list’s subscribers for the preview picker', async () => {
    await subscriber({ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'pro' })
    await subscriber({ name: 'Alan Turing', email: 'alan@example.com', plan: 'pro' })
    await subscriber({ name: 'Bob', email: 'bob@example.com', plan: 'free' })
    const pro = await list({
      name: 'Pro',
      filter: { plan: { equals: 'pro' } },
      source: 'subscribers',
    })

    const all = await (
      await call('newsletter-lists', `${pro.id}/subscribers`, { method: 'GET' })
    ).json()
    expect(all.totalDocs).toBe(2)

    const found = await (
      await call('newsletter-lists', `${pro.id}/subscribers?search=turing`, { method: 'GET' })
    ).json()
    expect(found.docs.map((d: { email: string }) => d.email)).toEqual(['alan@example.com'])
  })
})

describe('webhook', () => {
  test('should switch a document off when Resend reports an unsubscribe, without echoing it back', async () => {
    const doc = await subscriber({ name: 'Leaver', email: 'leaver@example.com' })
    const before = mock().state.requests.length

    const res = await webhook({
      type: 'contact.updated',
      data: { email: 'leaver@example.com', unsubscribed: true },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ updated: 1 })
    expect((await payload.findByID({ id: doc.id, collection: 'subscribers' })).subscribed).toBe(
      false,
    )
    expect(mock().state.requests.slice(before)).toEqual([])
  })

  test('should refuse an event with a bad signature', async () => {
    const res = await webhook(
      { type: 'contact.updated', data: { email: 'x@example.com', unsubscribed: true } },
      'whsec_d3Jvbmctc2VjcmV0',
    )
    expect(res.status).toBe(401)
  })
})

describe('resync', () => {
  test('should restore missing contacts and memberships and pull unsubscribes back', async () => {
    const everyone = await list({ name: 'Everyone', source: 'subscribers' })
    const a = await subscriber({ name: 'A', email: 'a@example.com' })
    await subscriber({ name: 'B', email: 'b@example.com' })

    // Drift: a contact deleted in the dashboard, a membership lost, an unsubscribe the webhook missed,
    // and someone added to the segment by hand.
    mock().state.contacts.delete('b@example.com')
    mock().state.segments.get(everyone.segmentId!)!.members.delete('b@example.com')
    mock().state.contacts.get('a@example.com')!.unsubscribed = true
    mock().state.contacts.set('stranger@example.com', {
      id: 'ct_stranger',
      email: 'stranger@example.com',
      properties: {},
      unsubscribed: false,
    })
    mock().state.segments.get(everyone.segmentId!)!.members.add('stranger@example.com')

    const result = await payload.resendBroadcasts.resync()

    expect(result).toMatchObject({
      contactsCreated: 1,
      errors: [],
      pulledUnsubscribes: 1,
      segmentAdds: 1,
      segmentRemovals: 1,
    })
    expect(segmentMembers(everyone.segmentId!)).toEqual(['a@example.com', 'b@example.com'])
    expect((await payload.findByID({ id: a.id, collection: 'subscribers' })).subscribed).toBe(false)
  })

  test('should recreate a segment deleted in Resend', async () => {
    const everyone = await list({ name: 'Everyone', source: 'subscribers' })
    await subscriber({ name: 'A', email: 'a@example.com' })
    mock().state.segments.delete(everyone.segmentId!)

    await payload.resendBroadcasts.resync({ lists: [everyone.id] })

    const after = await payload.findByID({ id: everyone.id, collection: 'newsletter-lists' })
    expect(after.segmentId).not.toBe(everyone.segmentId)
    expect(segmentMembers(after.segmentId!)).toEqual(['a@example.com'])
  })

  test('should record a background run started from the endpoint', async () => {
    const res = await payload.config.endpoints
      .find((e) => e.path === '/resend-broadcasts/resync')!
      .handler(
        Object.assign(
          await createPayloadRequest({
            config,
            request: new Request('http://localhost:3500/api/resend-broadcasts/resync', {
              body: '{}',
              method: 'POST',
            }),
          }),
          {
            user: {
              ...(await payload.findByID({ id: userId, collection: 'users' })),
              collection: 'users',
            },
          },
        ) as never,
      )
    const { runId } = await res.json()
    await payload.resendBroadcasts.idle()
    const run = await payload.findByID({ id: runId, collection: 'newsletter-sync-runs' })
    expect(run).toMatchObject({ scope: 'all', status: 'finished' })
    expect(run.finishedAt).toBeTruthy()
  })
})

describe('campaigns', () => {
  async function campaign(extra: Record<string, unknown> = {}) {
    const everyone = await list({ name: 'Everyone', source: 'subscribers' })
    return payload.create({
      collection: 'newsletter-campaigns',
      data: {
        name: 'October',
        body: await body(
          '# Hi {{firstName|there}}\n\nNews for {{company}} on the {{plan}} plan from {{site.name}}.',
        ),
        list: everyone.id,
        subject: 'News from {{site.name}}',
        ...extra,
      } as never,
    })
  }

  test('should preview as a chosen subscriber, with property fallbacks', async () => {
    const ada = await subscriber({
      name: 'Ada Lovelace',
      company: 'Analytical Engines',
      email: 'ada@example.com',
      plan: 'pro',
    })
    const bob = await subscriber({ name: '', email: 'bob@example.com', plan: 'free' })
    const doc = await campaign()

    const asAda = await (
      await call('newsletter-campaigns', `${doc.id}/preview`, {
        body: { subscriber: { id: ada.id, collection: 'subscribers' } },
      })
    ).json()
    expect(asAda.subject).toBe('News from Acme Weekly')
    expect(html(asAda.html)).toContain('Hi Ada')
    expect(html(asAda.html)).toContain(
      'News for Analytical Engines on the pro plan from Acme Weekly.',
    )
    expect(asAda.isSample).toBe(false)

    const asBob = await (
      await call('newsletter-campaigns', `${doc.id}/preview`, {
        body: { subscriber: { id: bob.id, collection: 'subscribers' } },
      })
    ).json()
    expect(html(asBob.html)).toContain('Hi there')
    expect(html(asBob.html)).toContain('News for your team on the free plan')
    expect(asBob.variables.find((v: { token: string }) => v.token === 'firstName')).toMatchObject({
      resend: '{{{contact.first_name}}}',
      used: true,
    })
  })

  test('should render a broadcast with Resend placeholders and the unsubscribe link', async () => {
    const doc = await campaign()
    const rendered = await payload.resendBroadcasts.render({ campaign: doc.id, mode: 'broadcast' })

    expect(html(rendered.html)).toContain('Hi {{{contact.first_name|there}}}')
    expect(html(rendered.html)).toContain('{{{contact.company|your team}}}')
    expect(html(rendered.html)).toContain('{{{contact.plan}}}')
    expect(html(rendered.html)).toContain('href="{{{RESEND_UNSUBSCRIBE_URL}}}"')
    expect(html(rendered.html)).toContain('Acme Weekly')
    expect(rendered.text).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
  })

  test('should reject per-subscriber variables in the subject and unknown ones in the body', async () => {
    await expect(campaign({ subject: 'Hi {{firstName}}' })).rejects.toThrow()
    await expect(campaign({ body: await body('Hello {{nickname}}') })).rejects.toThrow()
  })

  test('should send a test through Resend’s email API, filled in for the chosen subscriber', async () => {
    const ada = await subscriber({
      name: 'Ada Lovelace',
      company: 'AE',
      email: 'ada@example.com',
      plan: 'pro',
    })
    const doc = await campaign()

    const res = await call('newsletter-campaigns', `${doc.id}/test`, {
      body: { subscriber: { id: ada.id, collection: 'subscribers' }, to: 'editor@example.com' },
    })

    expect(res.status).toBe(200)
    const [sent] = mock().state.emails
    expect(sent).toMatchObject({
      from: 'Acme Weekly <news@acme.test>',
      subject: '[TEST] News from Acme Weekly',
      to: 'editor@example.com',
    })
    expect(html(sent.html)).toContain('Hi Ada')
    expect(html(sent.html)).not.toContain('RESEND_UNSUBSCRIBE_URL')
  })

  test('should send now as a broadcast to the list’s segment, lock the copy, then pick up the sent status', async () => {
    const doc = await campaign()
    const res = await call('newsletter-campaigns', `${doc.id}/send`)
    expect(res.status).toBe(200)

    const sending = await payload.findByID({
      id: doc.id,
      collection: 'newsletter-campaigns',
      depth: 1,
    })
    const broadcast = mock().state.broadcasts.get(sending.broadcastId!)!
    expect(sending.status).toBe('sending')
    expect(broadcast).toMatchObject({
      name: 'October',
      segment_id: (sending.list as { segmentId: string }).segmentId,
      status: 'queued',
    })
    expect(html(broadcast.html)).toContain('{{{contact.first_name|there}}}')

    await expect(
      payload.update({
        id: doc.id,
        collection: 'newsletter-campaigns',
        data: { subject: 'Changed' },
      }),
    ).rejects.toThrow(/already been sent/)
    expect((await call('newsletter-campaigns', `${doc.id}/send`)).status).toBe(409)

    broadcast.created_at = new Date(Date.now() - 5000).toISOString()
    const refreshed = await payload.resendBroadcasts.refreshStatus(doc.id)
    expect(refreshed.status).toBe('sent')
    expect(refreshed.sentAt).toBeTruthy()
  })

  test('should schedule, and cancel back to an editable draft', async () => {
    const doc = await campaign()
    const at = new Date(Date.now() + 3_600_000).toISOString()

    const scheduled = await payload.resendBroadcasts.send(doc.id, { scheduledAt: at })
    expect(scheduled).toMatchObject({ scheduledAt: at, status: 'scheduled' })
    expect(mock().state.broadcasts.get(scheduled.broadcastId!)).toMatchObject({
      scheduled_at: at,
      status: 'queued',
    })
    await expect(
      payload.update({ id: doc.id, collection: 'newsletter-campaigns', data: { subject: 'x' } }),
    ).rejects.toThrow(/scheduled/)

    const cancelled = await payload.resendBroadcasts.cancel(doc.id)
    expect(cancelled).toMatchObject({ broadcastId: null, scheduledAt: null, status: 'draft' })
    expect(mock().state.broadcasts.has(scheduled.broadcastId!)).toBe(false)
    await payload.update({
      id: doc.id,
      collection: 'newsletter-campaigns',
      data: { subject: 'Edited after cancel' },
    })
  })

  test('should refuse a schedule in the past and record Resend failures', async () => {
    const doc = await campaign()
    await expect(
      payload.resendBroadcasts.send(doc.id, { scheduledAt: new Date(Date.now() - 1000) }),
    ).rejects.toThrow(/minute ahead/)

    const l = await payload.findByID({
      id: (doc.list as { id: number }).id ?? doc.list,
      collection: 'newsletter-lists',
    })
    mock().state.segments.delete(l.segmentId!)
    await expect(payload.resendBroadcasts.send(doc.id)).rejects.toThrow(/segment_id/)
    const failed = await payload.findByID({ id: doc.id, collection: 'newsletter-campaigns' })
    expect(failed.status).toBe('failed')
    expect(failed.lastError).toMatch(/segment_id/)
  })

  test('should reset lifecycle fields when a campaign is duplicated or written through the API', async () => {
    const doc = await campaign()
    await payload.resendBroadcasts.send(doc.id)
    const copy = await payload.duplicate({ id: doc.id, collection: 'newsletter-campaigns' })
    expect(copy).toMatchObject({ broadcastId: null, status: 'draft' })

    const forged = await campaign({ broadcastId: 'bc_forged', status: 'sent' })
    expect(forged).toMatchObject({ broadcastId: null, status: 'draft' })
  })
})

describe('images', () => {
  async function upload(width: number, height: number, alt = 'A banner') {
    const data = await sharp({
      create: { background: '#4f46e5', channels: 3, height, width },
    })
      .png()
      .toBuffer()
    return payload.create({
      collection: 'media',
      data: { alt },
      file: { name: `banner-${width}.png`, data, mimetype: 'image/png', size: data.length },
    })
  }

  async function campaignWithImage(fields: Record<string, unknown>) {
    const everyone = await list({ name: 'Everyone', source: 'subscribers' })
    const content = (await body('# Hello {{firstName|there}}')) as { root: { children: unknown[] } }
    content.root.children.push({
      type: 'block',
      fields: { id: 'img1', blockName: '', blockType: 'image', width: 'full', ...fields },
      format: '',
      version: 2,
    })
    return payload.create({
      collection: 'newsletter-campaigns',
      data: { name: 'With image', body: content, list: everyone.id, subject: 'Pictures' } as never,
    })
  }

  test('should render an Image block at the content width with an absolute URL, link and caption', async () => {
    const media = await upload(1200, 600)
    const doc = await campaignWithImage({
      caption: 'Our new office in {{site.name}}',
      href: 'https://example.com/office',
      image: media.id,
    })

    const { html: out } = await payload.resendBroadcasts.render({
      campaign: doc.id,
      mode: 'broadcast',
    })
    const img = /<img[^>]*>/.exec(out)![0]

    expect(img).toContain(`src="http://localhost:3500/api/media/file/${media.filename}"`)
    expect(img).toContain('width="520"')
    expect(img).toContain('height="260"')
    expect(img).toContain('alt="A banner"')
    expect(html(out)).toContain('<a href="https://example.com/office"')
    expect(html(out)).toContain('Our new office in Acme Weekly')
  })

  test('should use the block’s alt text, its width, and never upscale a small image', async () => {
    const small = await upload(200, 100)
    const doc = await campaignWithImage({ alt: 'Custom alt', image: small.id, width: 'half' })

    const { html: out } = await payload.resendBroadcasts.render({ campaign: doc.id })
    const img = /<img[^>]*>/.exec(out)![0]

    expect(img).toContain('width="200"')
    expect(img).toContain('alt="Custom alt"')
  })

  test('should skip an image whose upload was deleted', async () => {
    const media = await upload(600, 300)
    const doc = await campaignWithImage({ image: media.id })
    await payload.delete({ collection: 'media', id: media.id })

    const { html: out } = await payload.resendBroadcasts.render({ campaign: doc.id })
    expect(out).not.toContain('<img')
  })

  test('should refuse to send images readers cannot load, and send once they are public', async () => {
    const media = await upload(1200, 600)
    const doc = await campaignWithImage({ image: media.id })
    const settings = payload.resendBroadcasts.options.media!
    settings.allowPrivateUrls = false
    try {
      const preview = await (await call('newsletter-campaigns', `${doc.id}/preview`)).json()
      expect(preview.privateImages).toEqual([
        `http://localhost:3500/api/media/file/${media.filename}`,
      ])
      await expect(payload.resendBroadcasts.send(doc.id)).rejects.toThrow(/could not load/)
      expect(mock().state.broadcasts.size).toBe(0)

      settings.baseUrl = 'https://cdn.example.com'
      const sent = await payload.resendBroadcasts.send(doc.id)
      expect(mock().state.broadcasts.get(sent.broadcastId!)!.html).toContain(
        `src="https://cdn.example.com/api/media/file/${media.filename}"`,
      )
    } finally {
      settings.allowPrivateUrls = true
      settings.baseUrl = undefined
    }
  })

  test('should refuse images only logged-in users can open, whatever the URL settings', async () => {
    const media = await upload(1200, 600)
    const doc = await campaignWithImage({ image: media.id })
    const access = payload.collections.media.config.access
    const publicRead = access.read
    access.read = ({ req }) => Boolean(req.user)
    try {
      const preview = await (await call('newsletter-campaigns', `${doc.id}/preview`)).json()
      expect(preview.privateImages).toEqual([
        `http://localhost:3500/api/media/file/${media.filename}`,
      ])
      await expect(payload.resendBroadcasts.send(doc.id)).rejects.toThrow(/needs no login/)
    } finally {
      access.read = publicRead
    }
  })
})
