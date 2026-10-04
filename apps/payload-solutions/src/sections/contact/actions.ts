'use server'

import { getConsentConfig } from '@payload-solutions/plugin-consent/server'
import { z } from 'zod'

import { getPayloadClient } from '@/lib/payload'

const schema = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  company: z.string().trim().max(160).optional(),
  topic: z.enum(['saas', 'stack', 'plugin', 'other']),
  message: z.string().trim().min(20, 'A few sentences help us reply well').max(4000),
  budget: z.string().trim().max(80).optional(),
  privacy: z.literal('on', { message: 'Please agree so we can reply to you' }),
  // honeypot: real people leave it empty
  website: z.string().max(0).optional(),
})

export type ContactState = { ok: boolean; error?: string; field?: string }

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const raw = Object.fromEntries(formData.entries())
  const parsed = schema.safeParse({
    ...raw,
    company: raw.company || undefined,
    budget: raw.budget || undefined,
    website: raw.website || undefined,
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    if (issue?.path[0] === 'website') return { ok: true } // silently drop bots
    return { ok: false, error: issue?.message ?? 'Check the form', field: String(issue?.path[0] ?? '') }
  }

  const { website: _honeypot, privacy: _privacy, ...data } = parsed.data
  const payload = await getPayloadClient()
  // Consent is the legal basis for keeping the enquiry, so store the proof with it (Art. 7(1)).
  const { versions } = await getConsentConfig(payload)
  const submission = await payload.create({
    collection: 'contact-submissions',
    data: { ...data, consentedAt: new Date().toISOString(), consentPolicyVersion: versions.documentsVersion },
    overrideAccess: true,
  })

  await notifyInbox({ payload, data, submissionId: submission.id })

  return { ok: true }
}

const DEFAULT_NOTIFY_EMAIL = 'hello@payload.solutions'

const TOPIC_LABELS: Record<ContactData['topic'], string> = {
  saas: 'Build a SaaS on Payload',
  stack: 'Payload Stack support',
  plugin: 'Plugin or integration',
  other: 'Something else',
}

type ContactData = Omit<z.infer<typeof schema>, 'website' | 'privacy'>

/**
 * Sends the enquiry to the team inbox with Reply-To set to the sender, so answering is one click.
 * The submission is already stored, so a failed send is logged, never shown to the visitor.
 */
async function notifyInbox({
  payload,
  data,
  submissionId,
}: {
  payload: Awaited<ReturnType<typeof getPayloadClient>>
  data: ContactData
  submissionId: number | string
}) {
  if (!process.env.RESEND_API_KEY) {
    payload.logger.warn('RESEND_API_KEY is not set: contact submission stored but no email sent')
    return
  }

  const to = process.env.CONTACT_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3200'
  const adminUrl = `${siteUrl}/admin/collections/contact-submissions/${submissionId}`
  const singleLine = (value: string) => value.replace(/[\r\n]+/g, ' ')
  const name = singleLine(data.name)
  const company = data.company ? singleLine(data.company) : undefined

  const rows: [string, string][] = [
    ['From', `${name} <${data.email}>`],
    ['Company', company ?? '—'],
    ['Topic', TOPIC_LABELS[data.topic]],
    ['Budget', data.budget ?? '—'],
  ]

  try {
    await payload.sendEmail({
      to,
      replyTo: data.email,
      subject: `New inquiry from ${name}${company ? ` (${company})` : ''}`,
      text: [...rows.map(([label, value]) => `${label}: ${value}`), '', data.message, '', `Open in admin: ${adminUrl}`].join('\n'),
      html: `<table cellpadding="4" style="font:14px/1.5 sans-serif;border-collapse:collapse">${rows
        .map(([label, value]) => `<tr><td style="color:#666">${label}</td><td>${escapeHtml(value)}</td></tr>`)
        .join('')}</table><p style="font:14px/1.6 sans-serif;white-space:pre-wrap">${escapeHtml(data.message)}</p><p style="font:13px sans-serif"><a href="${adminUrl}">Open in admin</a></p>`,
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Contact notification email failed' })
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
