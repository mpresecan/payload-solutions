// README banners: title over a dark streaked background, with a crop of a light admin screenshot below.
// Run from a plugin package: SPECS='[{"title":"Payload Emails","shot":"screenshots-out/payload-emails/preview-light.png","x":30,"y":56,"w":1410,"out":"banner.png"}]' node ../../notes/docs-screenshots/banner.mjs
// x/y/w crop the 1440x900 CSS-pixel screenshot; w is scaled to the 1120px card. GEIST_WOFF2 points at Geist-Regular.woff2.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const { chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright')

const SPECS = JSON.parse(process.env.SPECS)
const streaks = [
  // left%, width px, rotate deg, opacity, blur
  [-18, 120, 32, 0.55, 18], [-6, 60, 32, 0.35, 10], [6, 220, 32, 0.28, 40], [22, 40, 32, 0.6, 6],
  [30, 160, 32, 0.22, 30], [47, 90, 32, 0.45, 14], [58, 260, 32, 0.25, 50], [72, 50, 32, 0.55, 8],
  [80, 140, 32, 0.3, 26], [93, 70, 32, 0.5, 12], [104, 200, 32, 0.25, 36],
]
const bg = streaks.map(([l, w, r, o, b]) => `<div class="streak" style="left:${l}%;width:${w}px;transform:rotate(${r}deg);opacity:${o};filter:blur(${b}px)"></div>`).join('')
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 })
for (const s of SPECS) {
  const img = 'data:image/png;base64,' + fs.readFileSync(s.shot).toString('base64')
  const scale = 1120 / s.w
  await page.setContent(`<!doctype html><html><head><style>
  @font-face{font-family:Geist;src:url(data:font/woff2;base64,${fs.readFileSync(process.env.GEIST_WOFF2).toString('base64')})}
  html,body{margin:0;width:1280px;height:640px;overflow:hidden;background:#05070b}
  .bg{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 90% at 70% 0%,#0c1830 0%,#05070b 60%)}
  .streak{position:absolute;top:-60%;height:220%;background:linear-gradient(90deg,transparent,#3d6fa8 30%,#9cc3ee 50%,#3d6fa8 70%,transparent)}
  .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,11,.15) 0%,rgba(5,7,11,.55) 100%)}
  h1{position:absolute;top:58px;left:0;right:0;margin:0;text-align:center;font:400 ${s.size || 104}px/1 Geist,sans-serif;color:#fff;letter-spacing:-0.01em}
  .card{position:absolute;left:80px;top:203px;width:1120px;height:480px;border-radius:12px 12px 0 0;overflow:hidden;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .card img{position:absolute;width:${1440 * scale}px;left:${-s.x * scale}px;top:${-s.y * scale}px}
  </style></head><body><div class="bg">${bg}<div class="shade"></div></div><h1>${s.title}</h1><div class="card"><img src="${img}"></div></body></html>`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: s.out })
  console.log(s.out)
}
await browser.close()
