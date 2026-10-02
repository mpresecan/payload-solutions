import { open, settle, shoot } from './lib.mjs'
const [, , plugin, base] = process.argv
const { steps } = await import(`./steps-${plugin}.mjs`)
const only = process.env.ONLY?.split(',')
for (const theme of (process.env.THEMES || 'dark,light').split(',')) {
  const { browser, page } = await open({ base, theme, nav: false })
  for (const s of steps) {
    if (only && !only.includes(s.name)) continue
    try {
      await page.goto(s.path, { waitUntil: 'domcontentloaded' })
      await settle(page, 1200)
      if (s.nav) { await page.locator('.nav-toggler').first().click(); await page.waitForTimeout(600) }
      if (s.prep) await s.prep(page, theme)
      await settle(page, s.wait ?? 600)
      await shoot(page, plugin, s.name, theme, s.clip ? { clip: s.clip } : s.locator ? { locator: s.locator(page) } : {})
    } catch (e) { console.error('FAIL', s.name, theme, e.message.split('\n')[0]) }
  }
  await browser.close()
}
