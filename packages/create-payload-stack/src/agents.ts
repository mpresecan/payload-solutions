import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * The optional coding-agent step.
 *
 * Every project keeps `AGENTS.md`: it is the project's map and its rules, read by Codex, Cursor and
 * most other agents, and Next.js keeps its own agent rules in it. What this step decides is the
 * tool-specific layer on top:
 *
 *   claude  CLAUDE.md (imports AGENTS.md), .claude/skills, .claude/settings.json, .mcp.json
 *   codex   .agents/skills
 *   cursor  .cursor/mcp.json, and skills where Cursor reads them
 *
 * The template keeps one copy of the skills, in `.claude/skills`, because Claude Code reads only
 * that directory and Cursor reads it too. Codex reads only `.agents/skills`, so a Codex project gets
 * a copy there; a Cursor project without Claude Code gets its skills moved there, since that is the
 * directory Cursor documents as its own. A project for Claude Code and Cursor keeps one copy, so
 * Cursor does not list every skill twice.
 */

export const AGENT_KEYS = ['claude', 'codex', 'cursor'] as const
export type AgentKey = (typeof AGENT_KEYS)[number]

export const AGENT_CHOICES: Record<AgentKey, { label: string; hint: string }> = {
  claude: { label: 'Claude Code', hint: 'CLAUDE.md, skills, MCP servers in .mcp.json' },
  codex: { label: 'Codex', hint: 'skills in .agents/skills' },
  cursor: { label: 'Cursor', hint: 'skills, MCP servers in .cursor/mcp.json' },
}

/** Where the template keeps its skills, and where Claude Code (and Cursor) read them. */
export const CLAUDE_SKILLS_DIR = '.claude/skills'
/** Where Codex (and Cursor) read skills. */
export const AGENTS_SKILLS_DIR = '.agents/skills'

type McpServer = { command: string; args: string[] }

/**
 * MCP servers for a project. All of them run with `npx` and need nothing in package.json.
 * `payload-consent` is the bin of `@payload-solutions/plugin-consent`, so it is only listed when
 * the project has that plugin.
 */
export function mcpServers({ consent }: { consent: boolean }): Record<string, McpServer> {
  return {
    'next-devtools': { command: 'npx', args: ['-y', 'next-devtools-mcp@latest'] },
    playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
    shadcn: { command: 'npx', args: ['-y', 'shadcn@latest', 'mcp'] },
    ...(consent ? { 'payload-consent': { command: 'npx', args: ['payload-consent', 'mcp'] } } : {}),
  }
}

/** `.mcp.json` and `.cursor/mcp.json` share this shape. */
export function renderMcpJson(servers: Record<string, McpServer>): string {
  return `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`
}

/**
 * `--agents claude,codex` → the list; `--agents none` → []. Returns undefined when the flag was not
 * passed, and an error message for an unknown value.
 */
export function parseAgents(raw: string | undefined): { agents?: AgentKey[]; error?: string } {
  if (raw === undefined) return {}
  const items = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (items.length === 1 && items[0] === 'none') return { agents: [] }
  for (const item of items) {
    if (!(AGENT_KEYS as readonly string[]).includes(item)) {
      return { error: `Unknown value "${item}" for --agents. Allowed: ${AGENT_KEYS.join(', ')}, none` }
    }
  }
  // Keep the canonical order, drop repeats.
  return { agents: AGENT_KEYS.filter((key) => items.includes(key)) }
}

/** The files the chosen agents end up with, relative to the project. Pure, for tests and the summary. */
export function agentFiles(agents: readonly AgentKey[]): string[] {
  const has = (key: AgentKey) => agents.includes(key)
  return [
    'AGENTS.md',
    ...(has('claude') ? ['CLAUDE.md', CLAUDE_SKILLS_DIR, '.claude/settings.json', '.mcp.json'] : []),
    ...(has('codex') || (has('cursor') && !has('claude')) ? [AGENTS_SKILLS_DIR] : []),
    ...(has('cursor') ? ['.cursor/mcp.json'] : []),
  ]
}

/** Arranges the agent files for the chosen tools. Runs whatever the answer, like the other steps. */
export async function applyAgentsChoice(directory: string, agents: readonly AgentKey[], { consent }: { consent: boolean }) {
  const has = (key: AgentKey) => agents.includes(key)
  const at = (rel: string) => path.join(directory, rel)
  const servers = renderMcpJson(mcpServers({ consent }))

  if (agentFiles(agents).includes(AGENTS_SKILLS_DIR)) {
    if (!existsSync(at(CLAUDE_SKILLS_DIR))) {
      throw new Error(`The template is missing ${CLAUDE_SKILLS_DIR}; it cannot scaffold agent skills.`)
    }
    await mkdir(path.dirname(at(AGENTS_SKILLS_DIR)), { recursive: true })
    await cp(at(CLAUDE_SKILLS_DIR), at(AGENTS_SKILLS_DIR), { recursive: true })
  }

  if (has('claude')) {
    // The template's CLAUDE.md is only `@AGENTS.md`; keep it. The MCP list depends on the answers.
    await writeFile(at('.mcp.json'), servers)
  } else {
    for (const rel of ['CLAUDE.md', '.claude', '.mcp.json']) {
      await rm(at(rel), { force: true, recursive: true })
    }
  }

  if (has('cursor')) {
    await mkdir(at('.cursor'), { recursive: true })
    await writeFile(at('.cursor/mcp.json'), servers)
  }
}
