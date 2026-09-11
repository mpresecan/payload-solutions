import { describe, expect, it } from 'vitest'

import { describeCron } from './cron-describe.js'

describe('describeCron', () => {
  it.each([
    ['* * * * *', 'Every minute'],
    ['*/15 * * * *', 'Every 15 minutes'],
    ['0 * * * *', 'Every hour'],
    ['30 * * * *', 'Every hour at minute 30'],
    ['0 */6 * * *', 'Every 6 hours'],
    ['0 9 * * *', 'Every day at 09:00'],
    ['0 9 * * 1', 'Every Monday at 09:00'],
    ['0 9 * * 1-5', 'Every weekday at 09:00'],
    ['0 9 * * 1,3', 'Every Monday and Wednesday at 09:00'],
    ['0 3 1 * *', 'On the 1st at 03:00'],
    ['0 8 15 1 *', 'On the 15th in January at 08:00'],
    ['0 9,17 * * *', 'Every day at 09:00 and 17:00'],
    ['5 9-17 * * *', 'Every day at minute 5 past every hour from 09:00 to 17:00'],
    ['*/10 9-17 * * 1-5', 'Every weekday every 10 minutes from 09:00 to 17:59'],
  ])('%s → %s', (expression, words) => {
    expect(describeCron(expression)).toBe(words)
  })
  it('returns the input for unparseable expressions', () => {
    expect(describeCron('every monday')).toBe('every monday')
  })
})
