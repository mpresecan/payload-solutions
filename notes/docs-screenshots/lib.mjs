import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

// Resolve Playwright from the package the harness is run in (any plugin has it as a dev dependency).
const { chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright')

export const OUT = process.env.OUT || path.resolve('screenshots-out')

export async function open({ base, theme = 'dark', width = 1440, height = 900, nav = true }) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const context = await browser.newContext({
    baseURL: base,
    colorScheme: theme,
    deviceScaleFactor: 2,
    viewport: { width, height },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(90_000)
  const res = await page.request.post(`${base}/api/users/login`, {
    data: { email: 'dev@payloadcms.com', password: 'test' }, timeout: 180_000,
  })
  if (!res.ok()) throw new Error(`login failed ${res.status()}`)
  // Payload stores the theme preference in a cookie; colorScheme alone covers "auto".
  await context.addCookies([{ name: 'payload-theme', value: theme, url: base }])
  // Keep the nav open so the plugin's place in the admin is visible.
  await page.request.post(`${base}/api/payload-preferences/nav`, { data: { value: { open: nav } } })
  // Serve a neutral avatar instead of the dev user's Gravatar, so screenshots never depend on the network.
  await context.route(/gravatar\.com/, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#6b7280"/><circle cx="20" cy="16" r="7" fill="#e5e7eb"/><path d="M7 35c2-7 7-10 13-10s11 3 13 10" fill="#e5e7eb"/></svg>`,
    }),
  )
  return { browser, context, page }
}

export async function settle(page, ms = 800) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.addStyleTag({
    content: `nextjs-portal{display:none!important} *{caret-color:transparent!important} .payload-toast-container{display:none!important}`,
  })
  await page.waitForTimeout(ms)
}

/** Screenshot the viewport (or a clip/locator) into OUT/<plugin>/<name>-<theme>.png */
export async function shoot(page, plugin, name, theme, opts = {}) {
  const dir = path.join(OUT, plugin)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${name}-${theme}.png`)
  if (opts.locator) {
    await opts.locator.screenshot({ path: file })
  } else {
    await page.screenshot({ path: file, clip: opts.clip })
  }
  console.log('shot', file)
  return file
}
