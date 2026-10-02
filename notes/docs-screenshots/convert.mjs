// Converts OUT/<plugin>/*.png into apps/payload-solutions/public/images/docs/<plugin>/*.webp.
// Run from a package that has sharp installed (e.g. packages/plugin-emails): node ../../notes/docs-screenshots/convert.mjs
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sharp = createRequire(path.join(process.cwd(), 'noop.js'))('sharp')
const OUT = process.env.OUT || path.resolve('screenshots-out')
const DEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/payload-solutions/public/images/docs')

for (const plugin of fs.readdirSync(OUT)) {
  fs.mkdirSync(path.join(DEST, plugin), { recursive: true })
  for (const file of fs.readdirSync(path.join(OUT, plugin)).filter((f) => f.endsWith('.png'))) {
    const target = path.join(DEST, plugin, file.replace(/\.png$/, '.webp'))
    await sharp(path.join(OUT, plugin, file)).webp({ effort: 6, quality: 85 }).toFile(target)
    console.log(target)
  }
}
