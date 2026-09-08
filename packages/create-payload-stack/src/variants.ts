import { rm } from 'node:fs/promises'
import path from 'node:path'

/**
 * The template ships every optional step as two branches: the checked-in files under `src/`, and
 * the plugged-in alternative under `variants/<step>`. The CLI moves the chosen branch into place
 * and then removes the directory, so a scaffolded project keeps one obvious set of files.
 */
export const VARIANT_DIR = 'variants'

/** Path of one step's branch inside the template. */
export function variantPath(step: string): string {
  return path.join(VARIANT_DIR, step)
}

/** Removes `variants/` once every step has been applied. Runs whatever the answers were. */
export async function removeVariants(directory: string) {
  await rm(path.join(directory, VARIANT_DIR), { force: true, recursive: true })
}
