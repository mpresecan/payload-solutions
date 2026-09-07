import {
  INDEPENDENCE_NOTICE,
  PAYLOAD_TRADEMARK_ATTRIBUTION,
  brands,
} from '@payload-solutions/brand'
import { FooterWordmark } from '@payload-solutions/brand/footer-wordmark'
import { GridColumns } from '@payload-solutions/brand/grid-columns'

import { ThemeToggle } from '@/components/theme-toggle'

const solutions = brands.solutions

/*
  Same shape as payloadstack.com's footer, which is built to payloadcms.com's: four equal
  columns flush on the grid lines, the lattice running the full height, 12px/0.25em uppercase
  headings with a 72px drop to the first link, 16px links in full --fg, the theme control in
  the last column, and the oversized lockup closing the page. The trademark attribution is
  ours to carry and sits under the columns as a quiet line.
*/
interface FooterLink {
  label: string
  href: string
  soon?: boolean
}

const COLUMNS: Array<{ title: string; links: FooterLink[]; theme?: boolean }> = [
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
  {
    title: 'Stay connected',
    links: [{ label: 'GitHub', href: solutions.github }],
    theme: true,
  },
]

export function SiteFooter() {
  return (
    <footer className="relative isolate hairline-t pt-20 lg:pt-32">
      <GridColumns />

      <div className="container-content">
        <div className="grid grid-cols-1 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title} className="lg:pr-8">
              <h2 className="footer-heading">{col.title}</h2>
              {/* 72px from heading to first link at desktop, measured off payloadcms.com;
                  tightened on phones, where four stacked columns would otherwise sprawl. */}
              <ul className="mt-6 flex flex-col items-start gap-3.5 text-base lg:mt-[4.5rem] lg:gap-4">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-fg transition-colors hover:text-accent"
                      {...(/^https?:/.test(l.href)
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
                {col.theme ? (
                  <li>
                    <ThemeToggle variant="row" />
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>

        {/* Two columns rather than three, so the attribution crosses one grid line instead of
            two; the copyright keeps the last column, under the theme control. */}
        <div className="grid grid-cols-1 gap-y-4 pb-16 pt-16 text-[0.8125rem] leading-relaxed text-fg-subtle sm:grid-cols-2 lg:grid-cols-4 lg:pt-20">
          <p className="lg:col-span-2 lg:pr-8">
            {PAYLOAD_TRADEMARK_ATTRIBUTION} {INDEPENDENCE_NOTICE}
          </p>
          <p className="lg:col-start-4">
            MIT licensed. Copyright {new Date().getFullYear()} Payload Solutions.
          </p>
        </div>
      </div>

      <FooterWordmark brand="solutions" />
    </footer>
  )
}
