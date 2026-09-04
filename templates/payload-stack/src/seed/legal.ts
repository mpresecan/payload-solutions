import type { Payload } from 'payload'

import stack from '@/stack.config'

/**
 * Seeds starter legal pages on first boot. They are placeholders written in plain language for
 * `stack.legal.company`; have them reviewed before launch. Edit them in the admin under Content.
 */

type Paragraphs = Array<{ heading?: string; text: string }>

function richText(paragraphs: Paragraphs) {
  const children = paragraphs.flatMap((p) => {
    const nodes = []
    if (p.heading) {
      nodes.push({
        type: 'heading',
        tag: 'h2',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: [{ type: 'text', text: p.heading, version: 1, format: 0, detail: 0, mode: 'normal', style: '' }],
      })
    }
    nodes.push({
      type: 'paragraph',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      textFormat: 0,
      textStyle: '',
      children: [{ type: 'text', text: p.text, version: 1, format: 0, detail: 0, mode: 'normal', style: '' }],
    })
    return nodes
  })
  return {
    root: { type: 'root', version: 1, format: '', indent: 0, direction: 'ltr', children },
  }
}

export async function seedLegalPages(payload: Payload) {
  const existing = await payload.count({ collection: 'legal-pages', overrideAccess: true })
  if (existing.totalDocs > 0) return

  const { company, jurisdiction } = stack.legal
  const support = stack.support.email
  const app = stack.name
  const today = new Date().toISOString()

  const pages = [
    {
      title: 'Privacy Policy',
      slug: 'privacy',
      content: richText([
        { text: `This policy explains how ${company} ("we") handles personal data when you use ${app}.` },
        { heading: 'What we collect', text: 'Account details you give us (name, email), organization membership, billing records handled by our payment provider, and technical logs needed to run the service.' },
        { heading: 'Why we use it', text: 'To provide the service, keep accounts secure, send transactional email, bill subscriptions and comply with law. We do not sell personal data.' },
        { heading: 'Your rights', text: `You can export or delete your account from your settings at any time. For anything else, write to ${support}.` },
        { heading: 'Jurisdiction', text: `${company} operates under the laws of ${jurisdiction}.` },
      ]),
    },
    {
      title: 'Terms of Service',
      slug: 'terms',
      content: richText([
        { text: `These terms govern your use of ${app}, provided by ${company}. By creating an account you agree to them.` },
        { heading: 'Accounts and organizations', text: 'You are responsible for activity under your account and for members you invite to your organization.' },
        { heading: 'Subscriptions', text: 'Paid plans renew automatically until cancelled. You can cancel at any time from billing settings; access continues until the end of the paid period.' },
        { heading: 'Acceptable use', text: 'Do not use the service to break the law, infringe rights, or disrupt the service for others.' },
        { heading: 'Liability', text: `The service is provided as is. To the extent permitted by the laws of ${jurisdiction}, ${company} is not liable for indirect damages.` },
        { heading: 'Contact', text: `Questions about these terms: ${support}.` },
      ]),
    },
    {
      title: 'Cookie Policy',
      slug: 'cookies',
      content: richText([
        { text: `${app} uses a small number of cookies, all of them necessary to run the service.` },
        { heading: 'Session cookies', text: 'Keep you signed in and remember your active organization.' },
        { heading: 'Preference cookies', text: 'Remember your theme and sidebar state.' },
        { heading: 'Analytics', text: 'We do not set analytics or advertising cookies by default. If that changes, this page will be updated first.' },
      ]),
    },
  ]

  for (const page of pages) {
    await payload.create({
      collection: 'legal-pages',
      data: { ...page, effectiveDate: today, showInFooter: true, _status: 'published' } as never,
      overrideAccess: true,
    })
  }
  payload.logger.info(`Seeded ${pages.length} legal pages for ${company}`)
}
