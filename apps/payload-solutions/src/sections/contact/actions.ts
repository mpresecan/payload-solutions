'use server'

import { z } from 'zod'

import { getPayloadClient } from '@/lib/payload'

const schema = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  company: z.string().trim().max(160).optional(),
  topic: z.enum(['saas', 'stack', 'plugin', 'other']),
  message: z.string().trim().min(20, 'A few sentences help us reply well').max(4000),
  budget: z.string().trim().max(80).optional(),
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

  const { website: _honeypot, ...data } = parsed.data
  const payload = await getPayloadClient()
  await payload.create({ collection: 'contact-submissions', data, overrideAccess: true })

  const notify = process.env.CONTACT_NOTIFY_EMAIL
  if (notify && process.env.RESEND_API_KEY) {
    try {
      await payload.sendEmail({
        to: notify,
        subject: `New inquiry from ${data.name}${data.company ? ` (${data.company})` : ''}`,
        text: `${data.name} <${data.email}>\nTopic: ${data.topic}\nBudget: ${data.budget ?? 'n/a'}\n\n${data.message}`,
      })
    } catch (error) {
      payload.logger.warn({ err: error, msg: 'Contact notification email failed' })
    }
  }

  return { ok: true }
}
