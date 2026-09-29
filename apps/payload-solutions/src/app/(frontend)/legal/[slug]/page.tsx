import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { type JSXConverters, RichText } from '@payloadcms/richtext-lexical/react'
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
  return { title: page?.title ?? 'Legal', robots: { index: Boolean(page) } }
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
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{page.title}</h1>
            <p className="mt-3 text-sm text-fg-muted">Effective {effective}</p>
            <div className="prose mt-10 max-w-none">
              <RichText
                converters={({ defaultConverters }) => ({
                  ...defaultConverters,
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
