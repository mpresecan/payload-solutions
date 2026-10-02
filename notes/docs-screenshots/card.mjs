// Capture a card-width (1120 CSS px) admin screenshot so the layout reflows to the banner card instead of being cropped.
import { open, settle } from './lib.mjs'
const [, , base, path, out, prepName, w = '1120'] = process.argv
const { browser, page } = await open({ base, theme: 'light', width: Number(w), height: 760, nav: false })
await page.goto(path, { waitUntil: 'domcontentloaded' })
await settle(page, 2500)
const preps = {
  vercel: async (p) => { await p.locator('.plugin-vercel-header').getByRole('button', { name: /^Deploy/ }).first().waitFor() },
}
if (prepName && preps[prepName]) await preps[prepName](page)
await settle(page, 1200)
await page.screenshot({ path: out })
console.log(out)
await browser.close()
