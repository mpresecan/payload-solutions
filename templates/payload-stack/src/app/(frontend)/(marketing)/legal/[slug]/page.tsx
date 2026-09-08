import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LegalPageContent } from '@/consent/legal-page'
import { getPayloadClient } from '@/lib/payload'

type Params = { params: Promise<{ slug: string }> }

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

export async function generateStaticParams() {
  try {
    const payload = await getPayloadClient()
    const pages = await payload.find({ collection: 'legal-pages', select: { slug: true }, limit: 50, overrideAccess: true })
    return pages.docs.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
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
        <LegalPageContent page={page} effectiveDate={effective} />
      </div>
    </article>
  )
}
