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

  MOBILE: the table used to set a min-content width of ~394px inside a 335px box and push the
  whole PAGE into horizontal scroll — the collapsed row's time range is a nowrap string twice
  the width of any other cell. It is not put in an overflow-x scroller, because the collapsed
  row is the exhibit and a scroller hides exactly it. Below sm the five columns become three:
  the range breaks over two lines (each end still nowrap), and the status code and `detail`
  — which was simply hidden, though "11,208 runs" is the whole claim of that row — move onto
  a second line under the status. Type drops to 12px there too. Measured floor after this is
  ~257px of content, so it clears a 320px viewport, the narrowest still in use. Cells are
  `align-top` below sm or the two-line rows drift out of line with their own status, and back
  to `align-baseline` at sm so the desktop table renders exactly as it did before.
*/

interface Row {
  time: string
  timeEnd?: string
  status: string
  code: string
  detail: string
  duration: string
  tone: 'quiet' | 'work' | 'fail'
}

const ROWS: Row[] = [
  {
    time: 'Fri 17:02',
    status: 'Ran',
    code: '200',
    detail: '3 jobs, queue drained',
    duration: '412 ms',
    tone: 'work',
  },
  {
    time: 'Fri 16:58',
    status: 'Failed',
    code: '500',
    detail: 'ECONNRESET',
    duration: '20.0 s',
    tone: 'fail',
  },
  {
    time: 'Fri 16:57',
    status: 'Failed',
    code: '502',
    detail: 'Bad Gateway',
    duration: '1.2 s',
    tone: 'fail',
  },
  {
    time: 'Tue 09:14',
    timeEnd: 'Fri 16:56',
    status: 'Nothing to do',
    code: '200',
    detail: '11,208 runs',
    duration: '40–95 ms',
    tone: 'quiet',
  },
  {
    time: 'Tue 09:13',
    status: 'Ran',
    code: '200',
    detail: '41 jobs, 2 drain calls',
    duration: '2.8 s',
    tone: 'work',
  },
]

const TONE: Record<Row['tone'], string> = {
  quiet: 'text-fg-subtle',
  work: 'text-fg',
  fail: 'text-danger',
}

export function RunLedger({ className }: { className?: string }) {
  return (
    <div className={cn('border-beam border border-border-strong bg-bg', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-2.5 py-3 sm:px-5">
        <span className="label-mono">Run history</span>
        <span className="label-mono text-fg-subtle">retained 7 days &#183; 30 on failure</span>
      </div>

      <table className="w-full text-left text-[0.75rem] sm:text-[0.8125rem]">
        <caption className="sr-only">
          Example run history for one monitor, showing consecutive uneventful runs collapsed into a
          single row.
        </caption>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.time} className="border-b border-border last:border-b-0">
              <td className="px-2.5 py-3.5 align-top sm:align-baseline font-mono text-fg-subtle sm:whitespace-nowrap sm:px-5">
                <span className="whitespace-nowrap">{r.time}</span>
                {r.timeEnd ? (
                  <span className="block whitespace-nowrap sm:inline"> &#8212; {r.timeEnd}</span>
                ) : null}
              </td>
              <td
                className={cn('px-2 py-3.5 align-top sm:align-baseline font-medium', TONE[r.tone])}
              >
                {r.status}
                <span className="mt-1 block font-normal text-fg-muted sm:hidden">
                  <span className="font-mono">{r.code}</span> &#183; {r.detail}
                </span>
              </td>
              <td className="hidden px-2 py-3.5 align-top sm:align-baseline font-mono text-fg-subtle sm:table-cell">
                {r.code}
              </td>
              <td className="hidden px-2 py-3.5 align-top sm:align-baseline text-fg-muted sm:table-cell">
                {r.detail}
              </td>
              <td className="whitespace-nowrap px-2.5 py-3.5 text-right align-top sm:align-baseline font-mono text-fg-subtle sm:px-5">
                {r.duration}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
