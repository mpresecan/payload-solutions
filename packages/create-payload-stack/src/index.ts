import { createRequire } from 'node:module'
import pc from 'picocolors'

import { helpText, parse } from './args'
import { run } from './cli'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

async function main() {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(process.argv.slice(2))
  } catch (error) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)))
    console.log(helpText(version))
    process.exit(1)
  }
  if (parsed.flags.help) {
    console.log(helpText(version))
    return
  }
  if (parsed.flags.version) {
    console.log(version)
    return
  }
  await run(parsed.flags, parsed.positional)
}

main().catch((error) => {
  console.error(pc.red(error instanceof Error ? error.stack ?? error.message : String(error)))
  process.exit(1)
})
