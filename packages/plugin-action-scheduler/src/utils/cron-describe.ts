/**
 * Plain-English description of a 5-field cron expression. Covers the shapes people actually write
 * ("every N minutes", "daily at", "weekdays at", "on the 1st at"); anything else gets a literal
 * but readable sentence. Dependency-free so it can run in the admin bundle.
 */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
const isNumber = (f: string) => /^\d+$/.test(f)
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

function expandNames(field: string, names: string[], offset: number): null | string {
  if (field === '*') {
    return null
  }
  const parts = field.split(',').map((part) => {
    const range = /^(\d+)-(\d+)$/.exec(part)
    if (range) {
      const a = Number(range[1]) - offset
      const b = Number(range[2]) - offset
      if (names[a] && names[b]) {
        if (names === DAYS && a === 1 && b === 5) {
          return 'weekdays'
        }
        return `${names[a]} to ${names[b]}`
      }
    }
    if (isNumber(part)) {
      return names[(Number(part) - offset) % names.length] ?? part
    }
    return part
  })
  return list(parts)
}

export function describeCron(expression: string): string {
  const fields = String(expression ?? '').trim().split(/\s+/)
  if (fields.length === 6) {
    fields.shift()
  }
  if (fields.length !== 5) {
    return expression
  }
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string]
  const every = (f: string) => /^\*\/(\d+)$/.exec(f)?.[1]
  const allStar = dom === '*' && month === '*' && dow === '*'

  if (minute === '*' && hour === '*' && allStar) {
    return 'Every minute'
  }
  const em = every(minute)
  if (em && hour === '*' && allStar) {
    return `Every ${em} minutes`
  }
  const eh = every(hour)
  if (isNumber(minute) && eh && allStar) {
    return Number(minute) === 0 ? `Every ${eh} hours` : `Every ${eh} hours at minute ${minute}`
  }
  if (isNumber(minute) && hour === '*' && allStar) {
    return Number(minute) === 0 ? 'Every hour' : `Every hour at minute ${minute}`
  }

  const timePart = (() => {
    if (isNumber(minute) && isNumber(hour)) {
      return `at ${pad(Number(hour))}:${pad(Number(minute))}`
    }
    if (isNumber(minute) && /^\d+(,\d+)*$/.test(hour)) {
      return `at ${list(hour.split(',').map((h) => `${pad(Number(h))}:${pad(Number(minute))}`))}`
    }
    if (isNumber(minute) && /^(\d+)-(\d+)$/.test(hour)) {
      const [, a, b] = /^(\d+)-(\d+)$/.exec(hour)!
      return `at minute ${minute} past every hour from ${pad(Number(a))}:00 to ${pad(Number(b))}:00`
    }
    if (em && /^(\d+)-(\d+)$/.test(hour)) {
      const [, a, b] = /^(\d+)-(\d+)$/.exec(hour)!
      return `every ${em} minutes from ${pad(Number(a))}:00 to ${pad(Number(b))}:59`
    }
    if (minute === '*') {
      return `every minute during hour ${hour}`
    }
    return `at minute ${minute} past hour ${hour}`
  })()

  const days = expandNames(dow.replace(/\b7\b/g, '0'), DAYS, 0)
  const months = expandNames(month, MONTHS, 1)
  const dates = dom === '*' ? null : list(dom.split(',').map((d) => (isNumber(d) ? `the ${ordinal(Number(d))}` : d)))

  let when: string
  if (!days && !dates) {
    when = 'Every day'
  } else if (days && !dates) {
    when = days === 'weekdays' ? 'Every weekday' : `Every ${days}`
  } else if (dates && !days) {
    when = `On ${dates}`
  } else {
    when = `On ${dates} and every ${days}`
  }
  const monthPart = months ? ` in ${months}` : ''
  return `${when}${monthPart} ${timePart}`
}
