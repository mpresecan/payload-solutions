import { cn } from '@/lib/cn'

/*
  The run history, as it will actually look — including the collapsed row, which is the point.

  A one-minute monitor produces 43,776 runs a month and almost every one of them says the same
  nothing. Payload Clock folds consecutive identical uneventful runs into a single row with a
  count and a duration range, and opens a new row the moment anything changes. What survives
  at full resolution is the part an operator cares about: the failures.

  Rendered from data rather than as a screenshot because the product does not exist yet, and a
  faked screenshot of a product that does not exist is the one thing the design rules here
  will not allow. The border beam around it is the old site's, kept.
*/

interface Row {
  time: string
  status: string
  code: string
  detail: string
  duration: string
  tone: 'quiet' | 'work' | 'fail'
}

const ROWS: Row[] = [
  { time: 'Fri 17:02', status: 'Ran', code: '200', detail: '3 jobs, queue drained', duration: '412 ms', tone: 'work' },
  { time: 'Fri 16:58', status: 'Failed', code: '500', detail: 'ECONNRESET', duration: '20.0 s', tone: 'fail' },
  { time: 'Fri 16:57', status: 'Failed', code: '502', detail: 'Bad Gateway', duration: '1.2 s', tone: 'fail' },
  { time: 'Tue 09:14 — Fri 16:56', status: 'Nothing to do', code: '200', detail: '11,208 runs', duration: '40–95 ms', tone: 'quiet' },
  { time: 'Tue 09:13', status: 'Ran', code: '200', detail: '41 jobs, 2 drain calls', duration: '2.8 s', tone: 'work' },
]

const TONE: Record<Row['tone'], string> = {
  quiet: 'text-fg-subtle',
  work: 'text-fg',
  fail: 'text-danger',
}

export function RunLedger({ className }: { className?: string }) {
  return (
    <div className={cn('border-beam border border-border-strong bg-bg', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <span className="label-mono">Run history</span>
        <span className="label-mono text-fg-subtle">retained 7 days &#183; 30 on failure</span>
      </div>

      <table className="w-full text-left text-[0.8125rem]">
        <caption className="sr-only">
          Example run history for one monitor, showing consecutive uneventful runs collapsed
          into a single row.
        </caption>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.time} className="border-b border-border last:border-b-0">
              <td className="whitespace-nowrap px-4 py-3.5 font-mono text-fg-subtle sm:px-5">
                {r.time}
              </td>
              <td className={cn('px-2 py-3.5 font-medium', TONE[r.tone])}>{r.status}</td>
              <td className="px-2 py-3.5 font-mono text-fg-subtle">{r.code}</td>
              <td className="hidden px-2 py-3.5 text-fg-muted sm:table-cell">{r.detail}</td>
              <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-fg-subtle sm:px-5">
                {r.duration}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
