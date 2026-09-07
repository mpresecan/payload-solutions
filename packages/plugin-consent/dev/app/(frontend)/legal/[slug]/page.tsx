import config from '@payload-config'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { legalPageConverters } from '@payload-solutions/plugin-consent/rsc'
import { getConsentConfig, getProcessorTableData } from '@payload-solutions/plugin-consent/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'legal-pages',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: false,
  })
  const page = result.docs[0]
  if (!page) {
    notFound()
  }
  const consent = await getConsentConfig(payload, { headers: await headers() })
  const processors = await getProcessorTableData(payload)
  const effective = new Date(page.effectiveDate).toLocaleDateString('en-GB', { dateStyle: 'long' })

  return (
    <article data-legal-page={page.kind}>
      <h1>{page.title}</h1>
      <p>Effective {effective}</p>
      <RichText
        converters={({ defaultConverters }) => ({
          ...defaultConverters,
          ...legalPageConverters({
            categories: consent.categories,
            trackers: consent.trackers,
            documentsVersion: consent.versions.documentsVersion,
            effectiveDate: effective,
            ...processors,
          }),
        })}
        data={page.content}
      />
    </article>
  )
}
