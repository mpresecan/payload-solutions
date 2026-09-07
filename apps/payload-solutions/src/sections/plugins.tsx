import Link from 'next/link'
import { accentForSlug } from '@payload-solutions/brand'
import { SectionHead } from '@payload-solutions/brand/lattice'

import { Reveal } from '@/components/reveal'
import { StatusChip } from '@/components/status-chip'
import type { Plugin } from '@/payload-types'

/**
 * The plugin index, as a list of lattice rows. Like the product wall, each row carries its
 * own accent (Payload Consent is emerald, Payload Emails is rose), so the family reads as a
 * set of distinct things rather than one branded block.
 */
export function Plugins({ plugins }: { plugins: Plugin[] }) {
  return (
    <section
      id="plugins"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="plugins-heading"
    >
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="plugins-heading"
            eyebrow="Plugins"
            title="Plugins for every Payload project."
            lead="The pieces we kept rebuilding for clients, packaged so nobody has to build them again. Published under the @payload-solutions scope."
          />
        </Reveal>

        {/* Full width: each row is a rule across all four columns, like the roadmap below it. */}
        <ul className="mt-16">
          {plugins.map((plugin, i) => (
            <Reveal
              as="li"
              key={plugin.id}
              index={i}
              data-brand={accentForSlug(plugin.packageName ?? plugin.name)}
              className="grid grid-cols-1 gap-3 border-t border-border py-7 transition-colors duration-150 ease-standard hover:border-accent-line sm:grid-cols-[1fr_auto] sm:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="display-sm">
                    {plugin.docsPath ? (
                      <Link
                        href={plugin.docsPath}
                        className="transition-colors hover:text-accent"
                      >
                        {plugin.name}
                      </Link>
                    ) : (
                      plugin.name
                    )}
                  </h3>
                  {plugin.packageName ? (
                    <code className="font-mono text-xs text-fg-subtle">{plugin.packageName}</code>
                  ) : null}
                </div>
                <p className="mt-2.5 max-w-[60ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                  {plugin.summary}
                </p>
              </div>
              <StatusChip status={plugin.status} className="sm:mt-1" />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
