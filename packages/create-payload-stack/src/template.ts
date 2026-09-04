import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import * as tar from 'tar'

export const REPO = 'mpresecan/payload-solutions'
export const TEMPLATE_PATH = 'templates/payload-stack'

/**
 * Downloads templates/payload-stack from the GitHub repo tarball into `dest`, the same way
 * create-payload-app fetches its templates. `branch` may be a branch name or a tag.
 */
export async function downloadTemplate({ dest, branch }: { dest: string; branch: string }) {
  const url = `https://codeload.github.com/${REPO}/tar.gz/${encodeURIComponent(branch)}`
  const response = await fetch(url, { headers: { 'User-Agent': 'create-payload-stack' } })
  if (!response.ok || !response.body) {
    throw new Error(
      `Could not download the template (${response.status} ${response.statusText}) from ${url}.\n` +
        `Check your network, or pass --local-template <path> to scaffold from a local checkout.`,
    )
  }

  await mkdir(dest, { recursive: true })
  // Tarball root is "<repo>-<branch>/"; keep only the template directory and strip that prefix.
  const prefixDepth = 1 + TEMPLATE_PATH.split('/').length
  await pipeline(
    Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
    tar.x({
      cwd: dest,
      strip: prefixDepth,
      filter: (entryPath) => {
        const parts = entryPath.split('/')
        return parts.slice(1, 1 + TEMPLATE_PATH.split('/').length).join('/') === TEMPLATE_PATH
      },
    }),
  )

  if (!existsSync(path.join(dest, 'package.json'))) {
    throw new Error(`The downloaded archive did not contain ${TEMPLATE_PATH}/package.json (branch "${branch}").`)
  }
}

/** Copies a local checkout of templates/payload-stack (development and tests). */
export async function copyLocalTemplate({ from, dest }: { from: string; dest: string }) {
  const source = path.resolve(from)
  if (!existsSync(path.join(source, 'package.json'))) {
    throw new Error(`--local-template must point at a directory containing package.json (got ${source})`)
  }
  await mkdir(dest, { recursive: true })
  await cp(source, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(source, src)
      const top = rel.split(path.sep)[0]
      return !['node_modules', '.next', '.turbo', '.env', 'test-results', 'playwright-report', 'next-env.d.ts', 'tsconfig.tsbuildinfo', 'CLAUDE.md'].includes(top ?? '')
    },
  })
  // A local checkout may carry generated artifacts that should not ship.
  await rm(path.join(dest, 'CLAUDE.md'), { force: true })
}
