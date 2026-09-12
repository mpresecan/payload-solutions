import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'

import { SectionHead } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'
import type { RoadmapItem } from '@/payload-types'

/**
 * The roadmap, split by meaning rather than by stage.
 *
 * Four equal stage columns stopped working the moment the shipped column outgrew the others:
 * one tall column of history and three stubs, with the right half of the section empty, and it
 * only gets worse with every release — shipped is the one column that grows forever.
 *
 * So the section is two halves of the lattice. The left is what is done, drawn as a log: one
 * hairline row per release, newest first, title and quarter, no description, capped so ten
 * releases from now it is still a column and not a wall. The right is the part a visitor actually came for —
 * what is being built, what is next, what is being considered — with the descriptions on it.
 * Stages with nothing in them are simply absent; an empty column labelled "Nothing here yet"
 * was never worth the space.
 */

/** Releases listed in full before the rest are only counted. */
const SHIPPED_VISIBLE = 6

const FORWARD_STAGES: Array<{ key: RoadmapItem['stage']; label: string }> = [
  { key: 'in-progress', label: 'In progress' },
  { key: 'planned', label: 'Next' },
  { key: 'exploring', label: 'Exploring' },
]

/** The title, linked when the item carries a link — the arrow marks that it leaves the site. */
function ItemTitle({ item }: { item: RoadmapItem }) {
  if (!item.link) return <>{item.title}</>
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-baseline gap-1 hover:underline hover:decoration-border-strong hover:underline-offset-4"
    >
      {item.title} <ArrowUpRight size={12} weight="bold" aria-hidden />
    </a>
  )
}

function Quarter({ value }: { value?: string | null }) {
  if (!value) return null
  return <span className="shrink-0 font-mono text-[0.6875rem] text-fg-subtle">{value}</span>
}

export function Roadmap({ items }: { items: RoadmapItem[] }) {
  // `order` runs oldest release first — that is how the admin lists them and how the seed
  // writes them. A log reads the other way round, and the cap has to keep the newest releases
  // rather than the first ones ever shipped, so the reverse happens before the slice.
  const shipped = items.filter((item) => item.stage === 'shipped').reverse()
  const listed = shipped.slice(0, SHIPPED_VISIBLE)
  const earlier = shipped.length - listed.length

  const forward = FORWARD_STAGES.map((stage) => ({
    ...stage,
    items: items.filter((item) => item.stage === stage.key),
  })).filter((stage) => stage.items.length > 0)

  return (
    <section
      id="roadmap"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="roadmap-heading"
    >
      <div className="container-content col-grid">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <SectionHead
            id="roadmap-heading"
            eyebrow="In the open"
            title="Roadmap"
            lead="What is done, what we are on, what comes next. Managed in our own Payload admin and updated as things ship."
          />

          {listed.length > 0 ? (
            <>
              <h3 className="label-mono mt-14">Shipped</h3>
              <ul className="mt-5 border-t border-border">
                {listed.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-6 border-b border-border py-3.5"
                  >
                    <span className="min-w-0 text-[0.9375rem] font-medium leading-snug">
                      <ItemTitle item={item} />
                    </span>
                    <Quarter value={item.quarter} />
                  </li>
                ))}
              </ul>
              {earlier > 0 ? (
                <p className="mt-4 text-sm text-fg-subtle">
                  and {earlier} earlier {earlier === 1 ? 'release' : 'releases'}
                </p>
              ) : null}
            </>
          ) : null}
        </Reveal>

        <Reveal index={1} className="mt-16 lg:col-span-2 lg:mt-0 lg:pl-12">
          {forward.map((stage, i) => (
            <div key={stage.key} className={i === 0 ? '' : 'mt-10 border-t border-border pt-10'}>
              <h3 className="label-mono">{stage.label}</h3>
              <ul className="mt-5 space-y-7">
                {stage.items.map((item) => (
                  <li key={item.id}>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-lg font-medium leading-snug">
                        <ItemTitle item={item} />
                      </p>
                      <Quarter value={item.quarter} />
                    </div>
                    {item.description ? (
                      <p className="mt-1.5 max-w-[46ch] text-pretty text-sm leading-relaxed text-fg-muted">
                        {item.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
