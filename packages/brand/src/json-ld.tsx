import { GITHUB_REPO_URL, SOLUTIONS_URL, X_URL, brands } from './brands'

/*
  Structured data (schema.org JSON-LD) for search engines and AI answer engines.

  Both sites describe the same publisher, so the Organization node lives here once: the
  payload.solutions layout emits it as the site's owner, and payloadstack.com refers to it by
  @id as the publisher of the software. Facts only: names, URLs and the legal entity that is
  already named on the legal pages. No ratings, no review counts.
*/

export const ORGANIZATION_ID = `${SOLUTIONS_URL}/#organization`

export function organizationLd() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: brands.solutions.name,
    legalName: 'Fortbit d.o.o.',
    url: SOLUTIONS_URL,
    // public/logo.png on payload.solutions: a stable, unhashed raster, as Google asks for.
    logo: `${SOLUTIONS_URL}/logo.png`,
    description: brands.solutions.description,
    email: 'hello@payload.solutions',
    sameAs: [GITHUB_REPO_URL, X_URL],
  }
}

/**
 * Renders one JSON-LD block. `<` is escaped so a string in the data can never close the
 * script tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
