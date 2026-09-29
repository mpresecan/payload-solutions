<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Legal pages (Payload Consent)

Legal pages, cookie categories, trackers and the processor register live in Payload, not in this
repo. Before changing anything legal-adjacent:

- Run `npx payload-consent scan` and treat its findings as settled fact — it proves them.
- Use the `payload-consent` MCP server for anything that needs judgement, and read its skill first.
- Never invent a legal fact (controller identity, legal basis, retention period, DPO). Ask.
- Drafts are proposed to `.consent/proposals` and applied as draft versions only, never published.
