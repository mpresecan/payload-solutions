'use server'

import { getConsentConfig } from '@payload-solutions/plugin-consent/server'
import { z } from 'zod'

import { getPayloadClient } from '@/lib/payload'
import { PRO_STAGES, PRO_VERTICALS, type ProVertical } from '@/lib/pro'

const VERTICAL_VALUES = PRO_VERTICALS.map((v) => v.value) as [ProVertical, ...ProVertical[]]
const STAGE_VALUES = PRO_STAGES.map((s) => s.value) as [
  (typeof PRO_STAGES)[number]['value'],
  ...(typeof PRO_STAGES)[number]['value'][],
]

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  name: z.string().trim().max(120).optional(),
  verticals: z.array(z.enum(VERTICAL_VALUES)).max(VERTICAL_VALUES.length),
  otherVertical: z.string().trim().max(160).optional(),
  stage: z.enum(STAGE_VALUES).optional(),
  building: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(120).optional(),
  privacy: z.literal('on', { message: 'Please agree so we can email you about Pro' }),
  // honeypot: real people leave it empty
  website: z.string().max(0).optional(),
})

export type WaitlistState = { ok: boolean; error?: string; field?: string; returning?: boolean }

const blank = (value: FormDataEntryValue | null) =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

export async function joinProWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    name: blank(formData.get('name')),
    verticals: formData.getAll('verticals'),
    otherVertical: blank(formData.get('otherVertical')),
    stage: blank(formData.get('stage')),
    building: blank(formData.get('building')),
    source: blank(formData.get('source')),
    privacy: formData.get('privacy') ?? undefined,
    website: blank(formData.get('website')),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    if (issue?.path[0] === 'website') return { ok: true } // silently drop bots
    return { ok: false, error: issue?.message ?? 'Check the form', field: String(issue?.path[0] ?? '') }
  }

  const { website: _honeypot, privacy: _privacy, ...data } = parsed.data
  const payload = await getPayloadClient()
  const { versions } = await getConsentConfig(payload)
  const consent = { consentedAt: new Date().toISOString(), consentPolicyVersion: versions.documentsVersion }

  // One row per email. Signing up again updates the votes rather than erroring, and never
  // tells a visitor whether some other address is on the list beyond "you're on it".
  const existing = await payload.find({
    collection: 'pro-waitlist',
    where: { email: { equals: data.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const previous = existing.docs[0]

  if (previous) {
    await payload.update({
      collection: 'pro-waitlist',
      id: previous.id,
      data: {
        ...data,
        name: data.name ?? previous.name,
        ...consent,
        status: previous.status === 'removed' ? 'waiting' : previous.status,
      },
      overrideAccess: true,
    })
  } else {
    const created = await payload.create({
      collection: 'pro-waitlist',
      data: { ...data, ...consent },
      overrideAccess: true,
    })
    await sendEmails({ payload, data, id: created.id })
  }

  return { ok: true, returning: Boolean(previous) }
}

type WaitlistData = Omit<z.infer<typeof schema>, 'website' | 'privacy'>

const DEFAULT_NOTIFY_EMAIL = 'hello@payload.solutions'

/**
 * A short confirmation to the subscriber (so they know it worked and can whitelist the sender)
 * and a one-line notice to the team inbox. The row is already stored, so a failed send is
 * logged and never shown to the visitor.
 */
async function sendEmails({
  payload,
  data,
  id,
}: {
  payload: Awaited<ReturnType<typeof getPayloadClient>>
  data: WaitlistData
  id: number | string
}) {
  if (!process.env.RESEND_API_KEY) {
    payload.logger.warn('RESEND_API_KEY is not set: Pro waitlist signup stored but no email sent')
    return
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3200'
  const labels: string[] = data.verticals.map((v) => PRO_VERTICALS.find((p) => p.value === v)?.label ?? v)
  if (data.otherVertical) labels.push(data.otherVertical.replace(/[\r\n]+/g, ' '))
  const picked = labels.length ? labels.join(', ') : 'none picked yet'
  const hello = data.name ? `Hi ${data.name.replace(/[\r\n]+/g, ' ')},` : 'Hi,'

  const confirmation = [
    hello,
    '',
    "You're on the Payload Stack Pro waitlist. We'll write when the first vertical is ready, and before anyone else hears about it.",
    '',
    `You asked for: ${picked}. Your vote decides what we build first.`,
    '',
    'Nothing else will land in your inbox from this list. To leave it, reply to this email or write to privacy@payload.solutions.',
    '',
    'In the meantime, the free Payload Stack is one command away:',
    'npx create-payload-stack@latest',
    '',
    'Michael',
    'Payload Solutions',
  ].join('\n')

  try {
    await payload.sendEmail({
      to: data.email,
      replyTo: process.env.CONTACT_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL,
      subject: "You're on the Payload Stack Pro waitlist",
      text: confirmation,
      html: `<div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:560px">${confirmation
        .split('\n\n')
        .map((p) => `<p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(p)}</p>`)
        .join('')}</div>`,
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Pro waitlist confirmation email failed' })
  }

  try {
    await payload.sendEmail({
      to: process.env.CONTACT_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL,
      replyTo: data.email,
      subject: `Pro waitlist: ${data.email}`,
      text: [
        `Email: ${data.email}`,
        `Name: ${data.name ?? '—'}`,
        `Wants: ${picked}`,
        `Stage: ${data.stage ?? '—'}`,
        `Sent from: ${data.source ?? '—'}`,
        '',
        data.building ?? '',
        '',
        `Open in admin: ${siteUrl}/admin/collections/pro-waitlist/${id}`,
      ].join('\n'),
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Pro waitlist inbox notice failed' })
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
