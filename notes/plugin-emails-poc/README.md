# plugin-emails type-generation proof of concept

Companion to `notes/plugin-emails-spec.md` §6. Verified 2026-09-06 against `payload@3.88.0`.

```sh
mkdir /tmp/poc && cd /tmp/poc && cp <this folder>/* . 
npm init -y && npm pkg set type=module && npm i payload@3.88.0 typescript@5.7.3 tsx
npx tsx poc.ts                      # runs Payload's real generateTypes → payload-types.ts (compare with payload-types.generated.ts)
npx tsc -p tsconfig.json            # consumer.ts: positive cases compile, every @ts-expect-error fires
```

- `poc.ts` — two `defineEmail`-style definitions and the `typescript.schema` hook the plugin will ship.
- `consumer.ts` — the plugin's derived types (`TypedEmails`, `EmailInput`, `EmailVariables`, `defineEmail`, `EmailsAPI`, `BasePayload` augmentation) and a project using them.
- `fallback.ts` — proves the types degrade to untyped before the first `generate:types` run (`npx tsc -p tsconfig.json --files fallback.ts` or add it to `files`).
