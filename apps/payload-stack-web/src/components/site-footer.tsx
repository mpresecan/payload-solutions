import Link from 'next/link'
import {
  INDEPENDENCE_NOTICE,
  Logo,
  PAYLOAD_TRADEMARK_ATTRIBUTION,
  SOLUTIONS_URL,
  brands,
} from '@payload-solutions/brand'
import { FooterWordmark } from '@payload-solutions/brand/footer-wordmark'

const stack = brands.stack

const COLUMNS: Array<{
  title: string
  links: Array<{ label: string; href: string; soon?: boolean }>
}> = [
  {
    title: 'Payload Stack',
    links: [
      { label: 'Documentation', href: stack.docsUrl },
      { label: 'When to choose', href: '/when-to-choose' },
      { label: 'GitHub', href: stack.github },
      { label: 'Roadmap', href: `${SOLUTIONS_URL}/#roadmap` },
      { label: 'MIT License', href: `${stack.github}/blob/main/LICENSE` },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'Payload Solutions', href: SOLUTIONS_URL },
      { label: 'Payload Clock', href: brands.clock.url, soon: true },
      { label: 'Plugins', href: `${SOLUTIONS_URL}/#plugins` },
      { label: 'Hire us', href: `${SOLUTIONS_URL}/#contact` },
    ],
  },
  {
    title: 'Upstream',
    links: [
      { label: 'Payload CMS', href: 'https://payloadcms.com' },
      { label: 'Better Auth', href: 'https://better-auth.com' },
      { label: 'shadcn/ui', href: 'https://ui.shadcn.com' },
      { label: 'Next.js', href: 'https://nextjs.org' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="hairline-t">
      <div className="container-content grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-12 md:gap-8 md:py-16">
        <div className="col-span-2 md:col-span-5">
          <Link href="/" className="inline-flex text-fg" aria-label="Payload Stack home">
            <Logo brand="stack" size={24} />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-muted">{stack.tagline}</p>
          <p className="mt-6 text-sm text-fg-muted">
            A{' '}
            <a
              href={SOLUTIONS_URL}
              className="text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              payload.solutions
            </a>{' '}
            project.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="md:col-span-2 md:first-of-type:col-start-7">
            <h2 className="text-sm font-medium text-fg">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-fg-muted">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="transition-colors hover:text-fg"
                    {...(/^https?:/.test(l.href) && !l.href.startsWith(stack.url)
                      ? { target: '_blank', rel: 'noreferrer noopener' }
                      : {})}
                  >
                    {l.label}
                    {l.soon ? (
                      <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-fg-subtle">
                        soon
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hairline-t">
        <div className="container-content flex flex-col gap-3 py-6 text-xs leading-relaxed text-fg-subtle md:flex-row md:items-start md:justify-between">
          <p className="max-w-3xl">
            {PAYLOAD_TRADEMARK_ATTRIBUTION} {INDEPENDENCE_NOTICE}
          </p>
          <p className="shrink-0">
            MIT licensed. Copyright {new Date().getFullYear()} Payload Solutions.
          </p>
        </div>
      </div>

      <FooterWordmark brand="stack" />
    </footer>
  )
}
