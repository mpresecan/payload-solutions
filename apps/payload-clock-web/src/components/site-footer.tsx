import {
  INDEPENDENCE_NOTICE,
  PAYLOAD_TRADEMARK_ATTRIBUTION,
  SOLUTIONS_URL,
  brands,
} from '@payload-solutions/brand'
import { FooterWordmark } from '@payload-solutions/brand/footer-wordmark'
import { GridColumns } from '@payload-solutions/brand/grid-columns'

import { ThemeToggle } from '@/components/theme-toggle'

const clock = brands.clock

/*
  Structurally identical to payloadstack.com's footer — deliberately the same file shape, so
  the two cannot drift. Four flush columns on the grid lines, the theme control in the fourth,
  the trademark attribution carried verbatim under them, and the oversized lockup closing the
  page. Only the link sets differ.
*/
interface FooterLink {
  label: string
  href: string
  soon?: boolean
}

const COLUMNS: Array<{ title: string; links: FooterLink[]; theme?: boolean }> = [
  {
    title: 'Payload Clock',
    links: [
      { label: 'Documentation', href: clock.docsUrl },
      { label: 'How it works', href: '/#how' },
      { label: 'Free plan', href: '/#free' },
      { label: 'Roadmap', href: `${SOLUTIONS_URL}/#roadmap` },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'Payload Solutions', href: SOLUTIONS_URL },
      { label: 'Payload Stack', href: brands.stack.url },
      {
        label: 'Action Scheduler',
        href: `${SOLUTIONS_URL}/docs/plugins/payload-action-scheduler`,
      },
      { label: 'Hire us', href: `${SOLUTIONS_URL}/#contact` },
    ],
  },
  {
    title: 'Upstream',
    links: [
      { label: 'Payload CMS', href: 'https://payloadcms.com' },
      { label: 'Jobs Queue docs', href: 'https://payloadcms.com/docs/jobs-queue/overview' },
      { label: 'Next.js', href: 'https://nextjs.org' },
      { label: 'Google Cloud Tasks', href: 'https://cloud.google.com/tasks' },
    ],
  },
  {
    title: 'Stay connected',
    links: [
      { label: 'GitHub', href: clock.github },
      { label: 'Status', href: '/#free', soon: true },
    ],
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
                      {...(/^https?:/.test(l.href) && !l.href.startsWith(clock.url)
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

        <div className="grid grid-cols-1 gap-y-4 pb-16 pt-16 text-[0.8125rem] leading-relaxed text-fg-subtle sm:grid-cols-2 lg:grid-cols-4 lg:pt-20">
          <p className="lg:col-span-2 lg:pr-8">
            {PAYLOAD_TRADEMARK_ATTRIBUTION} {INDEPENDENCE_NOTICE}
          </p>
          <p className="lg:col-start-4">
            MIT licensed. Copyright {new Date().getFullYear()} Payload Solutions.
          </p>
        </div>
      </div>

      <FooterWordmark brand="clock" />
    </footer>
  )
}
