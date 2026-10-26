#!/usr/bin/env node
/**
 * Builds the Open Graph backdrops from the hero film posters, so every share card carries the
 * same light as the hero a visitor lands on.
 *
 *   <app>/src/app/.../og-assets/backdrop.jpg          the site's own poster, as the hero shows it
 *   payload-solutions/.../og-assets/backdrop-<accent>.jpg   one duotone per AccentId, for docs
 *
 * Satori (next/og) cannot decode WebP, and it has no filters, blend modes or CSS variables, so
 * every treatment is baked in here rather than applied in the card:
 *   - mirrored, so the light falls on the right and the copy column on the left stays dark
 *     (the site holds its copy at AA with a scrim; at thumbnail size the light is better moved
 *     out of the way than scrimmed over);
 *   - cover-cropped to 1200 x 630 from the 16:9 poster;
 *   - Clock's poster carries a black frame from its source, trimmed before cropping;
 *   - the docs variants map the solutions poster's luminance onto each entity's accent
 *     (black -> accent -> a little white at the hottest streak), so a Cookie Consent page gets
 *     emerald light, a Clock page brass, and so on.
 *
 * Needs `sharp`. It is not a dependency of the repo, so run it from anywhere sharp is installed:
 *   npm i sharp && node <repo>/packages/brand/scripts/og-backdrops.mjs <repo>
 * Re-run whenever a hero poster or an accent colour changes, and commit the JPEGs.
 */
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

// Resolved from the working directory, not from this file, so sharp installed wherever the
// command is run from is found.
const sharp = createRequire(path.join(process.cwd(), 'noop.js'))('sharp')

const repo = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../../..'))
const W = 1200
const H = 630

/** Dark values of ACCENT_COLORS in packages/brand/src/brands.ts. Keep in step. */
const ACCENTS = {
  solutions: '#5b9dff',
  stack: '#b4cee7',
  clock: '#f0b84d',
  consent: '#3dd98a',
  emails: '#ff7a8a',
  scheduler: '#3aced3',
  vercel: '#c175fc',
}

const SITES = [
  {
    poster: 'apps/payload-solutions/public/hero-solutions-poster.webp',
    out: 'apps/payload-solutions/src/app/(frontend)/og-assets',
    duotones: true,
  },
  {
    poster: 'apps/payload-stack-web/public/hero-poster.webp',
    out: 'apps/payload-stack-web/src/app/og-assets',
  },
  {
    poster: 'apps/payload-clock-web/public/hero-clock-poster.webp',
    out: 'apps/payload-clock-web/src/app/og-assets',
    // The source film fades into a black frame ~2% in from every edge.
    inset: 0.035,
  },
]

async function base({ poster, inset = 0 }) {
  const file = path.join(repo, poster)
  const { width, height } = await sharp(file).metadata()
  const dx = Math.round(width * inset)
  const dy = Math.round(height * inset)
  return sharp(file)
    .extract({ left: dx, top: dy, width: width - 2 * dx, height: height - 2 * dy })
    .flop()
    .resize(W, H, { fit: 'cover', position: 'centre' })
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** Luminance -> black..accent..white. The knee keeps most of the frame in the accent itself. */
async function duotone(image, accent) {
  const [r, g, b] = hex(accent)
  const { data, info } = await image.clone().greyscale().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 3)
  const KNEE = 0.72
  for (let i = 0; i < info.width * info.height; i++) {
    const l = data[i * info.channels] / 255
    const px =
      l < KNEE
        ? [r, g, b].map((c) => c * (l / KNEE))
        : [r, g, b].map((c) => c + (255 - c) * ((l - KNEE) / (1 - KNEE)) * 0.55)
    out[i * 3] = px[0]
    out[i * 3 + 1] = px[1]
    out[i * 3 + 2] = px[2]
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
}

const JPEG = { quality: 80, mozjpeg: true }

for (const site of SITES) {
  const dir = path.join(repo, site.out)
  await mkdir(dir, { recursive: true })
  const image = await base(site)
  await image.clone().jpeg(JPEG).toFile(path.join(dir, 'backdrop.jpg'))
  console.log(path.join(site.out, 'backdrop.jpg'))
  if (!site.duotones) continue
  for (const [id, accent] of Object.entries(ACCENTS)) {
    await (await duotone(image, accent)).jpeg(JPEG).toFile(path.join(dir, `backdrop-${id}.jpg`))
    console.log(path.join(site.out, `backdrop-${id}.jpg`))
  }
}
