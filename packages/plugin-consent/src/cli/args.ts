/** Minimal flag parsing. A CLI this small does not need a dependency for it. */
export type Args = {
  command: string
  positional: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }
    const [name, inline] = token.slice(2).split('=')
    if (inline !== undefined) {
      flags[name] = inline
    } else if (rest[i + 1] && !rest[i + 1].startsWith('--')) {
      flags[name] = rest[++i]
    } else {
      flags[name] = true
    }
  }
  return { command, positional, flags }
}

export function flagString(args: Args, name: string, fallback?: string): string | undefined {
  const value = args.flags[name]
  return typeof value === 'string' ? value : fallback
}

export function flagBool(args: Args, name: string): boolean {
  return args.flags[name] === true || args.flags[name] === 'true'
}
