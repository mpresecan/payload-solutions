/**
 * In-memory stand-in for the parts of the Resend API this plugin uses: contacts, contact
 * properties, segments (and segment membership), broadcasts and single emails. The dev app and
 * the integration tests point the Resend SDK at it with `baseUrl`, so nothing leaves the machine.
 *
 * Control routes (not part of Resend):
 *   GET  /__mock/state                          everything, for inspection
 *   POST /__mock/reset                          empty the store
 *   POST /__mock/contacts/:email/unsubscribe    act as the reader clicking the unsubscribe link:
 *                                               flips the contact and, when a webhook URL and
 *                                               secret are configured, delivers a signed
 *                                               `contact.updated` event to it
 */
import crypto from 'node:crypto'
import http from 'node:http'

/** @param {{ webhookUrl?: string, webhookSecret?: string }} [options] */
export function createResendMock(options = {}) {
  let counter = 0
  const id = (prefix) => `${prefix}_${String(++counter).padStart(6, '0')}`
  const now = () => new Date().toISOString()

  const state = {
    broadcasts: new Map(),
    contacts: new Map(), // email -> contact
    emails: [],
    properties: new Map(),
    requests: [],
    segments: new Map(), // id -> { id, name, created_at, members: Set<email> }
  }

  const reset = () => {
    for (const store of [state.broadcasts, state.contacts, state.properties, state.segments])
      store.clear()
    state.emails.length = 0
    state.requests.length = 0
  }

  const error = (statusCode, name, message) => ({
    body: { message, name, statusCode },
    status: statusCode,
  })
  const ok = (body, status = 200) => ({ body, status })

  const findContact = (identifier) => {
    const key = decodeURIComponent(identifier).toLowerCase()
    if (state.contacts.has(key)) return state.contacts.get(key)
    for (const contact of state.contacts.values()) if (contact.id === identifier) return contact
    return undefined
  }

  const publicContact = (c) => ({
    created_at: c.created_at,
    email: c.email,
    first_name: c.first_name,
    id: c.id,
    last_name: c.last_name,
    object: 'contact',
    unsubscribed: c.unsubscribed,
  })

  const paginate = (items, query) => {
    const limit = Math.min(100, Number(query.get('limit')) || 20)
    const after = query.get('after')
    let start = 0
    if (after) {
      const index = items.findIndex((item) => item.id === after)
      start = index === -1 ? items.length : index + 1
    }
    const page = items.slice(start, start + limit)
    return { data: page, has_more: start + limit < items.length, object: 'list' }
  }

  const broadcastStatus = (b) => {
    if (b.status === 'queued') {
      const due = b.scheduled_at
        ? new Date(b.scheduled_at).getTime()
        : new Date(b.created_at).getTime() + 1000
      if (Date.now() >= due) {
        b.status = 'sent'
        b.sent_at = now()
      }
    }
    return b
  }

  const validateProperties = (properties) => {
    for (const key of Object.keys(properties ?? {})) {
      if (!state.properties.has(key)) return `Contact property "${key}" does not exist.`
    }
    return null
  }

  /** @returns {Promise<{ status: number, body: unknown }>} */
  async function route(method, pathname, query, body) {
    const parts = pathname.split('/').filter(Boolean)
    const [root, a, b, c] = parts

    // ---- mock control
    if (root === '__mock') {
      if (a === 'reset' && method === 'POST') {
        reset()
        return ok({ reset: true })
      }
      if (a === 'state') {
        return ok({
          broadcasts: [...state.broadcasts.values()],
          contacts: [...state.contacts.values()],
          emails: state.emails,
          properties: [...state.properties.values()],
          segments: [...state.segments.values()].map((s) => ({ ...s, members: [...s.members] })),
        })
      }
      if (a === 'contacts' && c === 'unsubscribe' && method === 'POST') {
        const contact = findContact(b)
        if (!contact) return error(404, 'not_found', 'Contact not found')
        contact.unsubscribed = true
        const delivered = await deliverWebhook('contact.updated', contact)
        return ok({ delivered, unsubscribed: true })
      }
      return error(404, 'not_found', 'Unknown mock route')
    }

    // ---- contact properties
    if (root === 'contact-properties') {
      if (method === 'GET' && !a) return ok(paginate([...state.properties.values()], query))
      if (method === 'POST' && !a) {
        if (state.properties.has(body.key))
          return error(422, 'validation_error', `Property "${body.key}" already exists.`)
        const property = {
          created_at: now(),
          fallback_value: body.fallback_value ?? null,
          id: id('prop'),
          key: body.key,
          type: body.type,
        }
        state.properties.set(body.key, property)
        return ok({ id: property.id, object: 'contact_property' }, 201)
      }
    }

    // ---- segments
    if (root === 'segments') {
      if (method === 'POST' && !a) {
        const segment = { created_at: now(), id: id('seg'), members: new Set(), name: body.name }
        state.segments.set(segment.id, segment)
        return ok({ id: segment.id, name: segment.name, object: 'segment' }, 201)
      }
      if (method === 'GET' && !a) {
        return ok(
          paginate(
            [...state.segments.values()].map(({ members, ...s }) => s),
            query,
          ),
        )
      }
      const segment = state.segments.get(a)
      if (!segment) return error(404, 'not_found', 'Segment not found')
      if (method === 'GET' && !b)
        return ok({
          created_at: segment.created_at,
          id: segment.id,
          name: segment.name,
          object: 'segment',
        })
      if (method === 'PATCH' && !b) {
        segment.name = body.name ?? segment.name
        return ok({ id: segment.id, object: 'segment' })
      }
      if (method === 'DELETE' && !b) {
        state.segments.delete(a)
        return ok({ deleted: true, id: a, object: 'segment' })
      }
      if (method === 'GET' && b === 'contacts') {
        const members = [...state.contacts.values()].filter((contact) =>
          segment.members.has(contact.email),
        )
        return ok(paginate(members.map(publicContact), query))
      }
    }

    // ---- contacts
    if (root === 'contacts') {
      if (method === 'GET' && !a)
        return ok(paginate([...state.contacts.values()].map(publicContact), query))
      if (method === 'POST' && !a) {
        const email = String(body.email ?? '').toLowerCase()
        if (!email.includes('@')) return error(422, 'validation_error', 'Invalid email.')
        if (state.contacts.has(email))
          return error(409, 'validation_error', 'Contact already exists.')
        const invalid = validateProperties(body.properties)
        if (invalid) return error(422, 'validation_error', invalid)
        const contact = {
          created_at: now(),
          email,
          first_name: body.first_name ?? null,
          id: id('ct'),
          last_name: body.last_name ?? null,
          properties: { ...(body.properties ?? {}) },
          unsubscribed: Boolean(body.unsubscribed),
        }
        state.contacts.set(email, contact)
        for (const { id: segmentId } of body.segments ?? [])
          state.segments.get(segmentId)?.members.add(email)
        return ok({ id: contact.id, object: 'contact' }, 201)
      }
      const contact = findContact(a)
      if (!contact) return error(404, 'not_found', 'Contact not found')
      if (!b) {
        if (method === 'GET')
          return ok({ ...publicContact(contact), properties: contact.properties })
        if (method === 'PATCH') {
          const invalid = validateProperties(body.properties)
          if (invalid) return error(422, 'validation_error', invalid)
          if (body.first_name !== undefined) contact.first_name = body.first_name
          if (body.last_name !== undefined) contact.last_name = body.last_name
          if (body.unsubscribed !== undefined) contact.unsubscribed = Boolean(body.unsubscribed)
          if (body.properties) Object.assign(contact.properties, body.properties)
          return ok({ id: contact.id, object: 'contact' })
        }
        if (method === 'DELETE') {
          state.contacts.delete(contact.email)
          for (const segment of state.segments.values()) segment.members.delete(contact.email)
          return ok({ contact: contact.id, deleted: true, object: 'contact' })
        }
      }
      if (b === 'segments') {
        if (method === 'GET' && !c) {
          const segments = [...state.segments.values()].filter((s) => s.members.has(contact.email))
          return ok(
            paginate(
              segments.map(({ members, ...s }) => s),
              query,
            ),
          )
        }
        const segment = state.segments.get(c)
        if (!segment) return error(404, 'not_found', 'Segment not found')
        if (method === 'POST') {
          segment.members.add(contact.email)
          return ok({ id: segment.id })
        }
        if (method === 'DELETE') {
          if (!segment.members.delete(contact.email))
            return error(404, 'not_found', 'Contact is not in this segment')
          return ok({ deleted: true, id: segment.id })
        }
      }
    }

    // ---- broadcasts
    if (root === 'broadcasts') {
      if (method === 'POST' && !a) {
        const segment = state.segments.get(body.segment_id)
        if (!segment) return error(422, 'validation_error', 'segment_id is invalid.')
        if (!body.from || !body.subject)
          return error(422, 'missing_required_field', 'from and subject are required.')
        if (body.scheduled_at && !body.send)
          return error(422, 'validation_error', 'scheduled_at requires send.')
        const broadcast = {
          created_at: now(),
          from: body.from,
          html: body.html ?? null,
          id: id('bc'),
          name: body.name ?? null,
          preview_text: body.preview_text ?? null,
          reply_to: body.reply_to ? [].concat(body.reply_to) : null,
          scheduled_at: body.scheduled_at ?? null,
          segment_id: body.segment_id,
          sent_at: null,
          status: body.send ? 'queued' : 'draft',
          subject: body.subject,
          text: body.text ?? null,
        }
        state.broadcasts.set(broadcast.id, broadcast)
        return ok({ id: broadcast.id, object: 'broadcast' }, 201)
      }
      const broadcast = state.broadcasts.get(a)
      if (!broadcast) return error(404, 'not_found', 'Broadcast not found')
      if (method === 'GET' && !b) return ok({ ...broadcastStatus(broadcast), object: 'broadcast' })
      if (method === 'POST' && b === 'cancel') {
        broadcastStatus(broadcast)
        if (broadcast.status !== 'queued' || !broadcast.scheduled_at) {
          return error(422, 'validation_error', 'Only scheduled broadcasts can be cancelled.')
        }
        broadcast.status = 'draft'
        broadcast.scheduled_at = null
        return ok({ id: broadcast.id, object: 'broadcast' })
      }
      if (method === 'DELETE' && !b) {
        if (broadcast.status !== 'draft')
          return error(422, 'validation_error', 'Only drafts can be deleted.')
        state.broadcasts.delete(a)
        return ok({ deleted: true, id: a, object: 'broadcast' })
      }
    }

    // ---- single emails (test sends)
    if (root === 'emails' && method === 'POST' && !a) {
      if (!body.from || !body.to || !body.subject)
        return error(422, 'missing_required_field', 'from, to and subject are required.')
      const email = { ...body, created_at: now(), id: id('em') }
      state.emails.push(email)
      return ok({ id: email.id })
    }

    return error(404, 'not_found', `No mock for ${method} ${pathname}`)
  }

  async function deliverWebhook(type, contact) {
    if (!options.webhookUrl || !options.webhookSecret) return false
    const body = JSON.stringify({
      created_at: now(),
      data: {
        ...publicContact(contact),
        segment_ids: [...state.segments.values()]
          .filter((s) => s.members.has(contact.email))
          .map((s) => s.id),
        updated_at: now(),
      },
      type,
    })
    const headers = signWebhook(options.webhookSecret, body)
    try {
      const res = await fetch(options.webhookUrl, {
        body,
        headers: { ...headers, 'content-type': 'application/json' },
        method: 'POST',
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * Fetch-style handler, for mounting the mock inside the dev app as a Next route.
   * @param {Request} request
   * @param {string} [prefix] path prefix to strip, e.g. `/resend-mock`
   */
  async function handleRequest(request, prefix = '') {
    const url = new URL(request.url)
    const raw = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text()
    let body = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      body = {}
    }
    const pathname = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length) || '/'
      : url.pathname
    state.requests.push({ body, method: request.method, path: pathname })
    const { body: out, status } = await route(request.method, pathname, url.searchParams, body)
    return Response.json(out, { status })
  }

  /** Node request handler. */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://mock')
    let raw = ''
    for await (const chunk of req) raw += chunk
    let body = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      body = {}
    }
    const method = req.method ?? 'GET'
    state.requests.push({ body, method, path: url.pathname })
    const { body: out, status } = await route(method, url.pathname, url.searchParams, body)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(out))
  }

  /** @param {number} [port] 0 = any free port */
  async function listen(port = 0) {
    const server = http.createServer((req, res) => {
      handle(req, res).catch((err) => {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({ message: String(err), name: 'internal_server_error', statusCode: 500 }),
        )
      })
    })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', () => resolve(undefined))
    })
    const address = server.address()
    const actualPort = typeof address === 'object' && address ? address.port : port
    return {
      close: () => new Promise((resolve) => server.close(() => resolve(undefined))),
      url: `http://127.0.0.1:${actualPort}`,
    }
  }

  return { deliverWebhook, handle, handleRequest, listen, options, reset, state }
}

/**
 * Standard Webhooks signature, as Resend (via Svix) sends it:
 * base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), secret = base64 after `whsec_`.
 * @param {string} secret
 * @param {string} body
 */
export function signWebhook(
  secret,
  body,
  { id = `msg_${crypto.randomUUID()}`, timestamp = Math.floor(Date.now() / 1000) } = {},
) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signature = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  return { 'svix-id': id, 'svix-signature': `v1,${signature}`, 'svix-timestamp': String(timestamp) }
}
