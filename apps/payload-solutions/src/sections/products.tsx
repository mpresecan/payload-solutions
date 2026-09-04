import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

import { CopyCommand } from '@/components/copy-command'
import { Reveal } from '@/components/reveal'
import { StatusChip } from '@/components/status-chip'
import type { Product } from '@/payload-types'

export function Products({ products }: { products: Product[] }) {
  return (
    <section id="products" className="scroll-mt-header hairline-t py-section" aria-labelledby="products-heading">
      <div className="container-content">
        <Reveal className="max-w-2xl">
          <h2 id="products-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
            Products for people who build on Payload.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
          {products.map((product, i) => (
            <Reveal key={product.id} index={i} className="flex min-w-0 flex-col bg-bg p-7 lg:p-10">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-medium tracking-tight">{product.name}</h3>
                <StatusChip status={product.status} />
              </div>
              <p className="mt-2 text-lg text-fg-muted">{product.tagline}</p>
              <p className="mt-5 max-w-[52ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">{product.description}</p>
              {product.highlights?.length ? (
                <ul className="mt-6 grid gap-2 text-sm">
                  {product.highlights.map((h) => (
                    <li key={h.id ?? h.text} className="flex gap-3">
                      <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-border-strong" />
                      <span>{h.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                {product.command ? <CopyCommand command={product.command} /> : null}
                {product.url ? (
                  <a href={product.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                    Website <ArrowUpRight size={14} weight="bold" aria-hidden />
                  </a>
                ) : null}
                {product.docsPath ? (
                  <Link href={product.docsPath} className="inline-flex items-center gap-1 text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                    Documentation
                  </Link>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
