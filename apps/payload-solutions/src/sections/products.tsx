import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { accentForSlug } from '@payload-solutions/brand'
import { ClockDial } from '@payload-solutions/brand/clock-dial'
import { SectionHead } from '@payload-solutions/brand/lattice'
import { screens, type ScreenName } from '@payload-solutions/brand/screens'
import { ThemedImage } from '@payload-solutions/brand/themed-image'

import { CopyCommand } from '@/components/copy-command'
import { Reveal } from '@/components/reveal'
import { StatusChip } from '@/components/status-chip'
import type { Product } from '@/payload-types'

/**
 * Products that exist get a real screenshot of themselves. Payload Clock has no UI to
 * screenshot yet, and a mocked-up one would be a lie, so it shows its own signature diagram —
 * the same dial that carries payloadclock.com's hero — in the same bleeding frame.
 */
const SCREEN_BY_SLUG: Partial<Record<string, ScreenName>> = {
  'payload-stack': 'dashboard',
}

const DIAGRAM_BY_SLUG: Partial<Record<string, ReactNode>> = {
  'payload-clock': (
    // Sized and offset so the dial fills the frame and is cropped top and bottom, the way the
    // Stack screenshot is cropped right and bottom: an instrument seen close up, not a logo
    // floating in a box. The hub lands near the centre at every cell width.
    <ClockDial className="absolute -top-[22%] left-[-6%] w-[22rem] max-w-none sm:w-[25rem]" />
  ),
}

/**
 * The product wall. Each cell carries its own `data-brand`, so Payload Stack is platinum,
 * Payload Clock is brass and so on: the accent inside a cell — status chip, links, the
 * hairline that lifts on hover — belongs to that product rather than to the page. It is the
 * only place on the site where more than one accent is in view at once, and it is the point
 * of the section.
 */
export function Products({ products }: { products: Product[] }) {
  return (
    <section
      id="products"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="products-heading"
    >
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="products-heading"
            eyebrow="Products"
            title="Products for people who build on Payload."
          />
        </Reveal>

        <div className="list-grid mt-16 grid-cols-1 md:grid-cols-2">
          {products.map((product, i) => {
            const screen = SCREEN_BY_SLUG[product.slug]
            const diagram = DIAGRAM_BY_SLUG[product.slug]
            return (
              <Reveal
                key={product.id}
                index={i}
                data-brand={accentForSlug(product.slug)}
                className="list-cell group flex min-w-0 flex-col"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="display-md">{product.name}</h3>
                  <StatusChip status={product.status} />
                </div>
                <p className="mt-3 text-lg leading-snug text-fg-muted">{product.tagline}</p>
                <p className="mt-6 max-w-[52ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                  {product.description}
                </p>
                {product.highlights?.length ? (
                  <ul className="mt-7 grid gap-2.5 text-sm">
                    {product.highlights.map((h) => (
                      <li key={h.id ?? h.text} className="flex gap-3">
                        <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-accent" />
                        <span>{h.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                  {product.command ? <CopyCommand command={product.command} /> : null}
                  {product.url ? (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                    >
                      Website <ArrowUpRight size={14} weight="bold" aria-hidden />
                    </a>
                  ) : null}
                  {product.docsPath ? (
                    <Link
                      href={product.docsPath}
                      className="inline-flex items-center gap-1 text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                    >
                      Documentation
                    </Link>
                  ) : null}
                </div>
                {/* The visual bleeds into the cell's own padding, so it runs to the grid line
                    rather than floating inside a margin — and `mt-auto` pins it to the bottom
                    of the cell, so the two products' frames line up even though one cell has
                    more copy than the other. The padding is the minimum gap when there is no
                    slack to absorb; it sits on the wrapper so it cannot grow the frame. */}
                {screen || diagram ? (
                  <div className="-mb-8 -mr-6 mt-auto pt-10 lg:-mb-9 lg:-mr-8">
                    <div className="relative h-56 overflow-hidden border-l border-t border-border bg-surface">
                      {screen ? (
                        <ThemedImage
                          {...screens[screen]}
                          sizes="(min-width: 1024px) 640px, 90vw"
                          className="absolute left-[6%] top-[6%] w-[120%] max-w-none"
                        />
                      ) : (
                        diagram
                      )}
                    </div>
                  </div>
                ) : null}
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
