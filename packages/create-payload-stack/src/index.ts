import { parseArgs } from 'node:util'
import { createRequire } from 'node:module'
import pc from 'picocolors'

import { run } from './cli'
import { DB_KEYS } from './databases'
import type { CliFlags, PackageManager } from './options'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

const HELP = `
  ${pc.bold('create-payload-stack')} ${pc.dim(`v${version}`)}
  Scaffold a SaaS on Payload CMS: Better Auth, organizations, Stripe and a shadcn dashboard.

  ${pc.bold('Usage')}
    $ npx create-payload-stack@latest [name] [options]

  ${pc.bold('Options')}
    -n, --name <name>             Project name (also the directory)
    -d, --db <db>                 ${DB_KEYS.join(' | ')}
        --db-connection-string    Connection string written to .env
        --auth <list>             Comma-separated: email-password, magic-link, passkey
        --social <list>           Comma-separated: google, github
        --organizations           Enable organizations (teams)
        --no-organizations        Disable organizations
        --billing <mode>          organization | user | none
        --use-pnpm | --use-npm | --use-yarn | --use-bun
        --no-install              Skip dependency installation
        --no-git                  Skip git init
    -y, --defaults                Accept defaults for every unanswered prompt
        --branch <ref>            Git branch or tag of the template repo (default: main)
        --local-template <path>   Scaffold from a local checkout of templates/payload-stack
        --dry-run                 Print the resolved options and exit
    -h, --help                    Show this help
    -v, --version                 Show the version

  ${pc.bold('Examples')}
    $ npx create-payload-stack@latest ridgeline
    $ npx create-payload-stack@latest ridgeline -d sqlite --auth email-password,passkey --billing none -y

  Docs: https://payload.solutions/docs/payload-stack
`

function parse(argv: string[]): { flags: CliFlags; positional?: string } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      name: { type: 'string', short: 'n' },
      db: { type: 'string', short: 'd' },
      'db-connection-string': { type: 'string' },
      auth: { type: 'string' },
      social: { type: 'string' },
      organizations: { type: 'boolean' },
      billing: { type: 'string' },
      'use-pnpm': { type: 'boolean' },
      'use-npm': { type: 'boolean' },
      'use-yarn': { type: 'boolean' },
      'use-bun': { type: 'boolean' },
      install: { type: 'boolean', default: true },
      git: { type: 'boolean', default: true },
      defaults: { type: 'boolean', short: 'y', default: false },
      branch: { type: 'string', default: 'main' },
      'local-template': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  })

  const packageManager: PackageManager | undefined = values['use-pnpm']
    ? 'pnpm'
    : values['use-npm']
      ? 'npm'
      : values['use-yarn']
        ? 'yarn'
        : values['use-bun']
          ? 'bun'
          : undefined

  return {
    flags: {
      name: values.name,
      db: values.db,
      connectionString: values['db-connection-string'],
      auth: values.auth,
      social: values.social,
      organizations: values.organizations,
      billing: values.billing,
      packageManager,
      install: values.install ?? true,
      git: values.git ?? true,
      defaults: values.defaults ?? false,
      branch: values.branch ?? 'main',
      localTemplate: values['local-template'],
      dryRun: values['dry-run'] ?? false,
      help: values.help ?? false,
      version: values.version ?? false,
    },
    positional: positionals[0],
  }
}

async function main() {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(process.argv.slice(2))
  } catch (error) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)))
    console.log(HELP)
    process.exit(1)
  }
  if (parsed.flags.help) {
    console.log(HELP)
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
