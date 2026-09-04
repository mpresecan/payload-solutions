import Link from 'next/link'
import { INDEPENDENCE_NOTICE, Logo, PAYLOAD_TRADEMARK_ATTRIBUTION, brands } from '@payload-solutions/brand'

const solutions = brands.solutions

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string; soon?: boolean }> }> = [
  {
    title: 'Products',
    links: [
      { label: 'Payload Stack', href: brands.stack.url },
      { label: 'Payload Clock', href: brands.clock.url, soon: true },
      { label: 'Plugins', href: '/#plugins' },
      { label: 'Roadmap', href: '/#roadmap' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Payload Stack docs', href: '/docs/payload-stack' },
      { label: 'GitHub', href: solutions.github },
      { label: 'MIT License', href: `${solutions.github}/blob/main/LICENSE` },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Start a project', href: '/#contact' },
      { label: 'Payload CMS', href: 'https://payloadcms.com' },
      { label: 'Better Auth', href: 'https://better-auth.com' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="hairline-t">
      <div className="container-content grid grid-cols-1 gap-12 py-16 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <Link href="/" className="inline-flex text-fg" aria-label="Payload Solutions home">
            <Logo brand="solutions" size={24} />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-muted">{solutions.tagline}</p>
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
                    {...(/^https?:/.test(l.href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  >
                    {l.label}
                    {l.soon ? <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-fg-subtle">soon</span> : null}
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
          <p className="shrink-0">MIT licensed. Copyright {new Date().getFullYear()} Payload Solutions.</p>
        </div>
      </div>
    </footer>
  )
}
