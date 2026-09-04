import Link from 'next/link'

import { Reveal } from '@/components/reveal'
import { StatusChip } from '@/components/status-chip'
import type { Plugin } from '@/payload-types'

export function Plugins({ plugins }: { plugins: Plugin[] }) {
  return (
    <section id="plugins" className="scroll-mt-header hairline-t py-section" aria-labelledby="plugins-heading">
      <div className="container-content grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-4">
          <h2 id="plugins-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl">
            Plugins for every Payload project.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            The pieces we kept rebuilding for clients, packaged so nobody has to build them again.
            Published under the @payload-solutions scope.
          </p>
        </Reveal>

        <ul className="lg:col-span-8">
          {plugins.map((plugin, i) => (
            <Reveal as="li" key={plugin.id} index={i} className="grid grid-cols-1 gap-3 border-t border-border py-6 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="text-xl font-medium tracking-tight">
                    {plugin.docsPath ? (
                      <Link href={plugin.docsPath} className="hover:underline hover:decoration-border-strong hover:underline-offset-4">
                        {plugin.name}
                      </Link>
                    ) : (
                      plugin.name
                    )}
                  </h3>
                  {plugin.packageName ? <code className="font-mono text-xs text-fg-subtle">{plugin.packageName}</code> : null}
                </div>
                <p className="mt-2 max-w-[60ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">{plugin.summary}</p>
              </div>
              <StatusChip status={plugin.status} className="sm:mt-1" />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
