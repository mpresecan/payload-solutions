import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import { notFound } from 'next/navigation'
import type { SerializedTextNode } from '@payloadcms/richtext-lexical'
import { type JSXConverter, type JSXConverters, RichText } from '@payloadcms/richtext-lexical/react'
import { legalPageConverters } from '@payload-solutions/plugin-consent/rsc'
import { getConsentConfig, getProcessorTableData } from '@payload-solutions/plugin-consent/server'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getPayloadClient } from '@/lib/payload'

type Params = { params: Promise<{ slug: string }> }

/**
 * Legal pages managed under Privacy → Legal pages. The banner links here (`/legal/<slug>`).
 *
 * Alongside the rich text, the plugin's converters render the blocks an editor can drop into a
 * document: the cookie table, the recipients and sub-processor tables, and the policy version
 * line. They are generated from the trackers and processors in the admin, so the published page
 * cannot drift from what the site actually loads.
 */
async function getPage(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'legal-pages',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: false,
  })
  return result.docs[0] ?? null
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  return {
    title: page?.title ?? 'Legal',
    robots: { index: Boolean(page) },
    ...(page && { alternates: { canonical: `/legal/${page.slug}` } }),
  }
}

export default async function LegalPage({ params }: Params) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  const payload = await getPayloadClient()
  const [consent, processors] = await Promise.all([getConsentConfig(payload), getProcessorTableData(payload)])
  const effective = new Date(page.effectiveDate).toLocaleDateString('en-GB', { dateStyle: 'long' })

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <article className="container-content py-16 lg:py-24">
          {/* Loads in like the heroes: title, date, then the body, one after another. */}
          <div className="reveal-load-group mx-auto max-w-3xl">
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{page.title}</h1>
            <p className="mt-3 text-sm text-fg-muted">Effective {effective}</p>
            <div className="prose mt-10 max-w-none">
              <RichText
                converters={({ defaultConverters }) => ({
                  ...defaultConverters,
                  text: splitEmails(defaultConverters.text as JSXConverter<SerializedTextNode>),
                  // The cast works around a table-converter typing bug in plugin-consent 0.1.0,
                  // fixed in packages/plugin-consent; drop it once the next release is installed.
                  ...(legalPageConverters({
                    categories: consent.categories,
                    trackers: consent.trackers,
                    documentsVersion: consent.versions.documentsVersion,
                    effectiveDate: effective,
                    ...processors,
                  }) as unknown as JSXConverters),
                })}
                data={page.content}
              />
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}

const EMAIL = /([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)/g

/**
 * Renders every email address in the text with its `@` in its own element (`user<span>@</span>domain`).
 * Cloudflare's Email Address Obfuscation otherwise rewrites the address in the HTML, React finds
 * an `<a>` where it rendered text, throws #418 and re-renders the whole page on the client. Split
 * like this, Cloudflare leaves it alone. Formatting (bold, italic...) still comes from the default
 * converter, applied to each piece.
 */
function splitEmails(converter: JSXConverter<SerializedTextNode>): JSXConverter<SerializedTextNode> {
  // A converter may be a static node rather than a function; the default text one never is.
  if (typeof converter !== 'function') return converter
  const textConverter = converter
  return (args) => {
    const { node } = args
    if (!node.text.includes('@')) return textConverter(args)

    const render = (text: string) => textConverter({ ...args, node: { ...node, text } })
    const out: ReactNode[] = []
    let last = 0
    for (const match of node.text.matchAll(EMAIL)) {
      const [whole, user = '', domain = ''] = match
      if (match.index > last) out.push(render(node.text.slice(last, match.index)))
      out.push(render(user), <span key={`at-${match.index}`}>@</span>, render(domain))
      last = match.index + whole.length
    }
    if (last < node.text.length) out.push(render(node.text.slice(last)))
    return out.map((piece, i) => <Fragment key={i}>{piece}</Fragment>)
  }
}
