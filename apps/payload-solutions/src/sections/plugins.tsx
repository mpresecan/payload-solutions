import Link from 'next/link'
import { accentForSlug } from '@payload-solutions/brand'
import { ActionRow, ArrowGlyph, SectionHead } from '@payload-solutions/brand/lattice'

import { Reveal } from '@/components/reveal'
import { StatusChip } from '@/components/status-chip'
import type { Plugin } from '@/payload-types'

/**
 * The plugin index, drawn as a table of the lattice rather than a list hugging the left edge.
 *
 * The section is a directory, and at desktop widths it now says so: the headline takes the
 * first two columns and the index's own facts — scope, licence, how many you can install
 * today — take the other two, so the top of the section is not two empty columns of black.
 * Below it every plugin is a row on the same four columns as the background grid: name and
 * package on the first, what it does across the middle two, status on the last, under mono
 * column labels that make the width structural instead of accidental. The whole row is the
 * link to its documentation, which is also what gives the empty half of each row something
 * to be.
 *
 * Like the product wall, each row carries its own accent (Payload Consent is emerald, Payload
 * Emails is rose), so the family reads as a set of distinct things rather than one branded
 * block; here the accent shows up on hover, in the row's rule, its name and its arrow.
 */

/** `@payload-solutions/plugin-emails` → scope drawn quiet, package name at full strength. */
function splitPackage(packageName: string) {
  const cut = packageName.lastIndexOf('/')
  return cut === -1
    ? { scope: null, name: packageName }
    : { scope: packageName.slice(0, cut + 1), name: packageName.slice(cut + 1) }
}

export function Plugins({ plugins }: { plugins: Plugin[] }) {
  const available = plugins.filter((plugin) => plugin.status === 'available').length

  const facts: Array<[string, string]> = [
    ['Scope', '@payload-solutions'],
    ['License', 'MIT'],
    ['Available now', `${available} of ${plugins.length}`],
  ]

  return (
    <section
      id="plugins"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="plugins-heading"
    >
      <div className="container-content">
        {/* The claim on the first two columns, the facts that settle it on the other two. */}
        <div className="col-grid">
          <Reveal className="lg:col-span-2 lg:pr-12">
            <SectionHead
              id="plugins-heading"
              eyebrow="Plugins"
              title="Plugins for every Payload project."
              lead="The pieces we kept rebuilding for clients, packaged so nobody has to build them again."
            />
          </Reveal>

          <Reveal index={1} className="mt-12 lg:col-span-2 lg:mt-0 lg:self-end lg:pl-12">
            <dl className="border-t border-border">
              {facts.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-6 border-b border-border py-3.5"
                >
                  <dt className="label-mono">{label}</dt>
                  <dd className="font-mono text-[0.8125rem] text-fg">{value}</dd>
                </div>
              ))}
            </dl>
            {/* The row's own 1.5rem inset would put this label 1.5rem past the ledger labels above
                it, so it is zeroed: on this block the grid line is the only left edge. */}
            <ActionRow href="/docs/plugins" className="mt-8 [--slide-pad-x:0px]">
              All plugin documentation
            </ActionRow>
          </Reveal>
        </div>

        {/* Column labels, desktop only: on a phone the row is a stack and has no columns to
            label. They sit on the same four columns and paddings as the rows below. */}
        <div
          aria-hidden
          className="col-grid mt-20 hidden border-b border-border pb-3.5 lg:grid"
        >
          <span className="label-mono">Plugin</span>
          {/* The header cells are not merged: the centre line runs through this band and
              terminates on the rule under it, which is where the merged body cells start.
              Ending a vertical rule on a horizontal one is the point — stopping it in open
              space above the labels left it hanging. */}
          <span className="label-mono lg:col-span-2 lg:pl-8">What it does</span>
          <span className="label-mono lg:pl-8 lg:text-right">Status</span>
        </div>

        <ul className="mt-16 border-t border-border lg:mt-0 lg:border-t-0">
          {plugins.map((plugin, i) => {
            const pkg = plugin.packageName ? splitPackage(plugin.packageName) : null
            const row = (
              <>
                <div className="min-w-0 lg:py-7 lg:pr-8">
                  <h3 className="display-sm transition-colors duration-150 ease-standard group-hover:text-accent">
                    {plugin.name}
                  </h3>
                  {pkg ? (
                    <code className="mt-2 block break-words font-mono text-xs text-fg-subtle">
                      {pkg.scope ? <span className="opacity-60">{pkg.scope}</span> : null}
                      {pkg.name}
                    </code>
                  ) : null}
                </div>
                {/* Read the table as four columns with the middle two merged: a merged cell has
                    no rule inside it, so this one paints the page colour from the row's top rule
                    to its bottom (which is why the vertical padding sits on the cells rather than
                    on the row) and the centre line of the lattice is simply absent across the
                    table. The 1px side margins keep the quarter and three-quarter lines — the
                    cell's own edges — drawn. */}
                <p className="max-w-[54ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted lg:col-span-2 lg:mx-px lg:max-w-none lg:bg-bg lg:px-8 lg:pb-7 lg:pt-8">
                  {plugin.summary}
                </p>
                <div className="flex items-center gap-3 lg:items-start lg:justify-end lg:pb-7 lg:pl-8 lg:pt-8">
                  <StatusChip status={plugin.status} />
                  {/* Always in flow and always last in the DOM, so the chip keeps the right
                      edge on desktop, nothing shifts on hover, and rows without docs keep
                      the same rhythm as rows that have them. */}
                  <ArrowGlyph
                    size={12}
                    className={`shrink-0 text-accent opacity-0 transition-opacity duration-150 ease-standard lg:order-first ${
                      plugin.docsPath ? 'group-hover:opacity-100' : ''
                    }`}
                  />
                </div>
              </>
            )

            const rowClass =
              'grid grid-cols-1 gap-y-3 border-b border-border py-7 transition-colors duration-150 ease-standard hover:border-accent-line lg:grid-cols-4 lg:gap-y-0 lg:py-0'

            return (
              <Reveal
                as="li"
                key={plugin.id}
                index={i}
                data-brand={accentForSlug(plugin.packageName ?? plugin.name)}
                className="group"
              >
                {plugin.docsPath ? (
                  <Link href={plugin.docsPath} className={rowClass}>
                    {row}
                  </Link>
                ) : (
                  <div className={rowClass}>{row}</div>
                )}
              </Reveal>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
