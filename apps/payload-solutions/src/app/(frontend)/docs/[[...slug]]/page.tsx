import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GITHUB_REPO_URL, X_HANDLE, brands } from '@payload-solutions/brand'

import { source } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'

type Params = { params: Promise<{ slug?: string[] }> }

export default async function DocPage({ params }: Params) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body
  const editUrl = `${GITHUB_REPO_URL}/blob/main/docs/${page.path}`
  const markdownUrl = `${GITHUB_REPO_URL.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/main/docs/${page.path}`

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="flex flex-wrap justify-end gap-2">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={editUrl} />
      </div>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
      <div className="mt-8">
        <EditOnGitHub href={editUrl} />
      </div>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  // The page's own Open Graph card, drawn by docs-og/[...slug]. Both `openGraph` and
  // `twitter` REPLACE the objects from the root layout rather than merging into them, so
  // everything they carry has to be restated here — `card` above all: dropping it silently
  // falls back to `summary`, and the card renders as a small square thumbnail. Only the
  // twitter IMAGES are inherited, from openGraph.
  const image = ['/docs-og', ...(slug ?? []), 'image.png'].join('/')
  const title = page.data.title
  const description = page.data.description

  return {
    title,
    description,
    alternates: { canonical: page.url },
    openGraph: {
      type: 'article',
      siteName: brands.solutions.name,
      url: page.url,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: `${title} — ${brands.solutions.name} documentation` }],
    },
    twitter: { card: 'summary_large_image', site: X_HANDLE, creator: X_HANDLE, title, description },
  }
}
