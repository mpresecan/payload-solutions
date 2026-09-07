import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Wires the project up for whichever agent the developer already pays for.
 *
 * There is no API key to set and no provider to choose, because the package contains no model
 * code: the agent is the one already running in their terminal, and this writes the two things
 * it needs — an MCP server entry and the skill that tells it how to behave around legal text.
 */

export type InitOptions = { root: string; agent?: string; force?: boolean }

const SERVER_ENTRY = { command: 'npx', args: ['payload-consent', 'mcp'] }

const AGENTS_SECTION = `
## Legal pages (Payload Consent)

Legal pages, cookie categories, trackers and the processor register live in Payload, not in this
repo. Before changing anything legal-adjacent:

- Run \`npx payload-consent scan\` and treat its findings as settled fact — it proves them.
- Use the \`payload-consent\` MCP server for anything that needs judgement, and read its skill first.
- Never invent a legal fact (controller identity, legal basis, retention period, DPO). Ask.
- Drafts are proposed to \`.consent/proposals\` and applied as draft versions only, never published.
`

function skillSource(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill')
}

function mergeMcpConfig(file: string, force: boolean): 'written' | 'kept' | 'created' {
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify({ mcpServers: { 'payload-consent': SERVER_ENTRY } }, null, 2)}\n`, 'utf8')
    return 'created'
  }
  let current: Record<string, any> = {}
  try {
    current = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>
  } catch {
    return 'kept'
  }
  current.mcpServers ??= {}
  if (current.mcpServers['payload-consent'] && !force) return 'kept'
  current.mcpServers['payload-consent'] = SERVER_ENTRY
  writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
  return 'written'
}

export function detectAgent(root: string): string {
  if (existsSync(path.join(root, '.claude'))) return 'claude'
  if (existsSync(path.join(root, '.cursor'))) return 'cursor'
  return 'generic'
}

export function runInit(options: InitOptions): string[] {
  const { root, force = false } = options
  const agent = options.agent ?? detectAgent(root)
  const done: string[] = []

  const mcpFile = agent === 'cursor' ? path.join(root, '.cursor', 'mcp.json') : path.join(root, '.mcp.json')
  const state = mergeMcpConfig(mcpFile, force)
  done.push(
    state === 'kept'
      ? `${path.relative(root, mcpFile)} already lists payload-consent (use --force to overwrite)`
      : `${state} ${path.relative(root, mcpFile)} with the payload-consent MCP server`,
  )

  const skillTarget = path.join(root, '.claude', 'skills', 'payload-consent-legal')
  const source = skillSource()
  if (existsSync(source)) {
    if (existsSync(skillTarget) && !force) {
      done.push(`${path.relative(root, skillTarget)} already exists (use --force to overwrite)`)
    } else {
      mkdirSync(path.dirname(skillTarget), { recursive: true })
      cpSync(source, skillTarget, { recursive: true })
      done.push(`installed the legal skill into ${path.relative(root, skillTarget)}`)
    }
  } else {
    done.push('could not find the bundled skill; reinstall @payload-solutions/plugin-consent')
  }

  const agentsFile = path.join(root, 'AGENTS.md')
  if (existsSync(agentsFile)) {
    const current = readFileSync(agentsFile, 'utf8')
    if (!current.includes('Payload Consent)')) {
      writeFileSync(agentsFile, `${current.trimEnd()}\n${AGENTS_SECTION}`, 'utf8')
      done.push('added a Payload Consent section to AGENTS.md')
    } else {
      done.push('AGENTS.md already mentions Payload Consent')
    }
  } else {
    writeFileSync(agentsFile, `# Agent notes\n${AGENTS_SECTION}`, 'utf8')
    done.push('created AGENTS.md with a Payload Consent section')
  }

  const gitignore = path.join(root, '.gitignore')
  if (existsSync(gitignore)) {
    const current = readFileSync(gitignore, 'utf8')
    if (!current.includes('.consent/proposals')) {
      writeFileSync(gitignore, `${current.trimEnd()}\n\n# payload-consent drafts awaiting review\n.consent/proposals/\n`, 'utf8')
      done.push('ignored .consent/proposals in .gitignore')
    }
  }

  return done
}
