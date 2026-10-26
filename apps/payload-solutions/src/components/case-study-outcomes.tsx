import type { CaseStudy } from '@/payload-types'

/**
 * The numbers row of a case study: the first thing a reader scans, and the only place the
 * page makes a quantitative claim. Cells sit on the lattice (list-grid), one per column at
 * lg. An outcome with a `source` gets a footnote mark, and the sources are listed underneath,
 * so a figure someone else measured is never presented as ours.
 */
export function CaseStudyOutcomes({
  outcomes,
  className,
  compact = false,
}: {
  outcomes: NonNullable<CaseStudy['outcomes']>
  className?: string
  /** Two columns instead of four: the home page teaser, where the row shares the width. */
  compact?: boolean
}) {
  if (!outcomes.length) return null
  const sourced = outcomes.filter((o) => o.source)

  return (
    <div className={className}>
      <dl className={`list-grid grid-cols-1 sm:grid-cols-2 ${compact ? '' : 'lg:grid-cols-4'}`}>
        {outcomes.map((outcome) => {
          const mark = outcome.source ? sourced.indexOf(outcome) + 1 : 0
          return (
            <div key={outcome.id ?? outcome.value} className="list-cell flex flex-col">
              <dt className="sr-only">{outcome.label}</dt>
              <dd className="display-lg tabular-nums">
                {outcome.value}
                {mark ? (
                  <sup className="ml-1 align-super font-mono text-xs font-normal text-fg-subtle">{mark}</sup>
                ) : null}
              </dd>
              <dd className="mt-3 flex gap-3 text-[0.9375rem] leading-snug text-fg-muted">
                <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-accent" />
                <span>{outcome.label}</span>
              </dd>
            </div>
          )
        })}
      </dl>
      {sourced.length ? (
        <ol className="mt-4 space-y-1 text-xs text-fg-subtle">
          {sourced.map((o, i) => (
            <li key={o.id ?? o.value}>
              <span className="font-mono">{i + 1}</span> {o.source}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
