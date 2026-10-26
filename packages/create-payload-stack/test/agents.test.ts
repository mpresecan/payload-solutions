/**
 * src/agents.ts: the coding-agent step. Which files each choice of agents ends up with, the MCP
 * servers written for it, and that the template carries what the step moves around. The scaffold
 * suite checks the same choices against a real scaffolded directory.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { AGENT_KEYS, AGENTS_SKILLS_DIR, agentFiles, CLAUDE_SKILLS_DIR, mcpServers, parseAgents, renderMcpJson } from '../src/agents'

const templateDir = path.resolve(__dirname, '../../../templates/payload-stack')

describe('the template', () => {
  it('keeps one copy of the skills, in .claude/skills, each with a name and a description', () => {
    expect(existsSync(path.join(templateDir, AGENTS_SKILLS_DIR))).toBe(false)
    const skills = readdirSync(path.join(templateDir, CLAUDE_SKILLS_DIR))
    expect(skills).toEqual(expect.arrayContaining(['payload', 'stack-collection', 'stack-dashboard-page', 'stack-email', 'stack-scheduled-action', 'stack-tests']))
    for (const skill of skills) {
      const source = readFileSync(path.join(templateDir, CLAUDE_SKILLS_DIR, skill, 'SKILL.md'), 'utf8')
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? ''
      expect(frontmatter, skill).toMatch(new RegExp(`^name: ${skill}$`, 'm'))
      expect(frontmatter, skill).toMatch(/^description: .{40,}$/m)
    }
  })

  it('names every skill in AGENTS.md, so agents without skill support still find the recipes', () => {
    const agents = readFileSync(path.join(templateDir, 'AGENTS.md'), 'utf8')
    for (const skill of readdirSync(path.join(templateDir, CLAUDE_SKILLS_DIR))) expect(agents, skill).toContain(`\`${skill}\``)
    expect(agents).toContain('pnpm verify')
  })

  it('ships CLAUDE.md as an import of AGENTS.md, and the .mcp.json the default answers produce', () => {
    expect(readFileSync(path.join(templateDir, 'CLAUDE.md'), 'utf8').trim()).toBe('@AGENTS.md')
    expect(JSON.parse(readFileSync(path.join(templateDir, '.mcp.json'), 'utf8'))).toEqual(JSON.parse(renderMcpJson(mcpServers({ consent: false }))))
  })

  it('has the verify script the skills and AGENTS.md tell agents to run', () => {
    const pkg = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts.verify).toBe('pnpm run typecheck && pnpm run lint && pnpm run test:unit')
  })
})

describe('parseAgents', () => {
  it('is undefined without the flag', () => {
    expect(parseAgents(undefined)).toEqual({})
  })

  it('reads a list in any order and case, and returns it in canonical order without repeats', () => {
    expect(parseAgents('Cursor, claude ,cursor')).toEqual({ agents: ['claude', 'cursor'] })
    expect(parseAgents(AGENT_KEYS.join(','))).toEqual({ agents: [...AGENT_KEYS] })
  })

  it('reads none as an empty list', () => {
    expect(parseAgents('none')).toEqual({ agents: [] })
  })

  it('rejects an unknown agent, and none mixed with others', () => {
    expect(parseAgents('claude,copilot').error).toMatch(/Unknown value "copilot"/)
    expect(parseAgents('none,claude').error).toMatch(/Unknown value "none"/)
  })
})

describe('agentFiles', () => {
  it('always keeps AGENTS.md', () => {
    expect(agentFiles([])).toEqual(['AGENTS.md'])
  })

  it('gives Claude Code its instructions, skills, settings and MCP servers', () => {
    expect(agentFiles(['claude'])).toEqual(['AGENTS.md', 'CLAUDE.md', CLAUDE_SKILLS_DIR, '.claude/settings.json', '.mcp.json'])
  })

  it('gives Codex its own skills directory', () => {
    expect(agentFiles(['codex'])).toEqual(['AGENTS.md', AGENTS_SKILLS_DIR])
  })

  it('moves the skills to .agents/skills for Cursor alone, and keeps one copy next to Claude Code', () => {
    expect(agentFiles(['cursor'])).toEqual(['AGENTS.md', AGENTS_SKILLS_DIR, '.cursor/mcp.json'])
    expect(agentFiles(['claude', 'cursor'])).not.toContain(AGENTS_SKILLS_DIR)
  })
})

describe('mcpServers', () => {
  it('lists the three servers every project can use, all through npx', () => {
    const servers = mcpServers({ consent: false })
    expect(Object.keys(servers)).toEqual(['next-devtools', 'playwright', 'shadcn'])
    for (const server of Object.values(servers)) expect(server.command).toBe('npx')
  })

  it('adds the Cookie Consent audit server only with the plugin', () => {
    expect(mcpServers({ consent: true })['payload-consent']).toEqual({ command: 'npx', args: ['payload-consent', 'mcp'] })
  })

  it('renders the shape Claude Code and Cursor both read', () => {
    expect(JSON.parse(renderMcpJson(mcpServers({ consent: false })))).toHaveProperty('mcpServers.playwright')
  })
})
