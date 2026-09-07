# create-payload-stack

Scaffold a SaaS on Payload CMS in one command.

```bash
npx create-payload-stack@latest
```

Seven prompts: project name, database (PostgreSQL, MongoDB, SQLite, Vercel Postgres), connection string, sign-in methods, organizations, billing, media storage (skip for local disk, or Vercel Blob, AWS S3, Cloudflare R2, Azure Blob Storage, Google Cloud Storage, Uploadthing). The CLI downloads [Payload Stack](https://www.payloadstack.com), writes your answers into `src/stack.config.ts`, swaps the Payload database adapter, wires the storage adapter into `payload.config.ts`, generates `.env` with fresh secrets, installs dependencies and initializes git.

```bash
# non-interactive
npx create-payload-stack@latest ridgeline -d postgres --auth email-password,magic-link,passkey --social github --billing organization --storage vercel-blob -y
```

Run `npx create-payload-stack@latest --help` for every flag. Documentation: https://payload.solutions/docs/payload-stack

## Development

```bash
pnpm --filter create-payload-stack build
node packages/create-payload-stack/dist/index.js my-app --local-template templates/payload-stack --no-install
pnpm --filter create-payload-stack test
```

MIT. A [payload.solutions](https://payload.solutions) project.
