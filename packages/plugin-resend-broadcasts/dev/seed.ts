import type { Payload } from 'payload'

import { markdownToLexical } from '@payload-solutions/plugin-resend-broadcasts'
import sharp from 'sharp'

import { devUser } from './helpers/credentials.js'

const PEOPLE: Array<{
  company?: string
  email: string
  name: string
  plan: 'free' | 'pro'
  subscribed?: boolean
}> = [
  { name: 'Ada Lovelace', company: 'Analytical Engines', email: 'ada@example.com', plan: 'pro' },
  { name: 'Grace Hopper', company: 'Harvard Mark I', email: 'grace@example.com', plan: 'pro' },
  { name: 'Alan Turing', email: 'alan@example.com', plan: 'free' },
  { name: 'Claude Shannon', company: 'Bell Labs', email: 'claude@example.com', plan: 'pro' },
  { name: 'Margaret Hamilton', email: 'margaret@example.com', plan: 'free' },
  { name: 'Katherine Johnson', email: 'katherine@example.com', plan: 'free', subscribed: false },
  { name: 'Alan Kay', company: 'Xerox PARC', email: 'alan.kay@example.com', plan: 'pro' },
  { name: 'Barbara Liskov', email: 'barbara@example.com', plan: 'free' },
  { name: 'Edsger Dijkstra', email: 'edsger@example.com', plan: 'free' },
  { name: 'Donald Knuth', company: 'Stanford', email: 'don@example.com', plan: 'pro' },
  { name: 'Frances Allen', email: 'frances@example.com', plan: 'free' },
  { name: 'John McCarthy', email: 'john@example.com', plan: 'free' },
]

const WELCOME = `
# Hello {{firstName|there}},

Here is what shipped this month at **{{site.name}}**.

- Faster exports
- A new dashboard for {{company}}
- Dark mode, finally

<Button label="See what's new" url="https://example.com/changelog" />

Thanks for reading,

The team
`

export const seed = async (payload: Payload) => {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: devUser.email } },
  })
  if (totalDocs) {
    return
  }
  await payload.create({ collection: 'users', data: { ...devUser, name: 'Dev User' } })

  const toLexical = async (markdown: string) =>
    (await markdownToLexical(payload.config, markdown)) as never

  await payload.updateGlobal({
    slug: 'newsletter-settings',
    data: {
      footer: await toLexical(
        'You get this because you signed up at {{site.name}}. Acme Inc., 1 Example Street.',
      ),
      siteName: 'Acme Weekly',
    },
  })

  for (const person of PEOPLE) {
    await payload.create({
      collection: 'subscribers',
      data: {
        name: person.name,
        company: person.company,
        email: person.email,
        plan: person.plan,
        subscribed: person.subscribed ?? true,
      },
    })
  }

  // Creating a list creates its Resend segment and fills it in the background.
  const everyone = await payload.create({
    collection: 'newsletter-lists',
    data: {
      name: 'All subscribers',
      description: 'Everyone who signed up for the newsletter.',
      source: 'subscribers',
    },
  })
  await payload.create({
    collection: 'newsletter-lists',
    data: { name: 'Pro customers', filter: { plan: { equals: 'pro' } }, source: 'subscribers' },
  })

  // A generated banner, so the sample campaign shows the Image block without shipping a binary.
  const banner = await payload.create({
    collection: 'media',
    data: { alt: 'Acme Weekly — October' },
    file: await bannerPng(),
  })
  const body = (await toLexical(WELCOME)) as { root: { children: unknown[] } }
  body.root.children.splice(1, 0, {
    type: 'block',
    fields: {
      id: 'seed-banner',
      align: 'center',
      blockName: '',
      blockType: 'image',
      image: banner.id,
      width: 'full',
    },
    format: '',
    version: 2,
  })

  await payload.create({
    collection: 'newsletter-campaigns',
    data: {
      name: 'October product update',
      body: body as never,
      list: everyone.id,
      previewText: 'Faster exports, a new dashboard and dark mode.',
      subject: 'What’s new at {{site.name}} this month',
    },
  })
}

async function bannerPng() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#18181b"/><stop offset="1" stop-color="#4f46e5"/>
    </linearGradient></defs>
    <rect width="1200" height="500" fill="url(#g)"/>
    <text x="80" y="290" fill="#fafafa" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700">October at Acme</text>
  </svg>`
  const data = await sharp(Buffer.from(svg)).png().toBuffer()
  return { name: 'october-banner.png', data, mimetype: 'image/png', size: data.length }
}
