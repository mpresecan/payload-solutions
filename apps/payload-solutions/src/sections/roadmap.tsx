import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'

import { Reveal } from '@/components/reveal'
import type { RoadmapItem } from '@/payload-types'

const STAGES: Array<{ key: RoadmapItem['stage']; label: string }> = [
  { key: 'shipped', label: 'Shipped' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'planned', label: 'Planned' },
  { key: 'exploring', label: 'Exploring' },
]

export function Roadmap({ items }: { items: RoadmapItem[] }) {
  return (
    <section id="roadmap" className="scroll-mt-header hairline-t py-section" aria-labelledby="roadmap-heading">
      <div className="container-content">
        <Reveal className="max-w-2xl">
          <h2 id="roadmap-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
            Roadmap
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            What is done, what we are on, what comes next. Managed in our own Payload admin and updated as
            things ship.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage, i) => {
            const stageItems = items.filter((item) => item.stage === stage.key)
            return (
              <Reveal key={stage.key} index={i} className="flex min-w-0 flex-col bg-bg p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-muted">{stage.label}</h3>
                <ul className="mt-5 space-y-5">
                  {stageItems.length === 0 ? (
                    <li className="text-sm text-fg-subtle">Nothing here yet.</li>
                  ) : (
                    stageItems.map((item) => (
                      <li key={item.id}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium leading-snug">
                            {item.link ? (
                              <a href={item.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:underline hover:decoration-border-strong hover:underline-offset-4">
                                {item.title} <ArrowUpRight size={12} weight="bold" aria-hidden />
                              </a>
                            ) : (
                              item.title
                            )}
                          </p>
                          {item.quarter ? <span className="shrink-0 font-mono text-[0.6875rem] text-fg-subtle">{item.quarter}</span> : null}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{item.description}</p>
                      </li>
                    ))
                  )}
                </ul>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
