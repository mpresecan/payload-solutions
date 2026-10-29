import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { renderLegalPageContent } from '@/consent/legal-page'
import { getPayloadClient } from '@/lib/payload'

type Params = { params: Promise<{ slug: string }> }

// Rendered on request, like every other marketing page: the consent layer reads the request, and a
// statically generated route that does so fails at runtime (DYNAMIC_SERVER_USAGE) whenever the
// build had no database to list the slugs. No generateStaticParams here for that reason.

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
  return { title: page?.title ?? 'Legal' }
}

export default async function LegalPage({ params }: Params) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  const effective = new Date(page.effectiveDate).toLocaleDateString('en-US', { dateStyle: 'long' })

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective {effective}</p>
      <div className="prose-legal mt-8">
        {await renderLegalPageContent(page, effective)}
      </div>
    </article>
  )
}
