# @payload-solutions/consent-react

React bindings for [Payload Consent](https://payload.solutions/docs/plugins/payload-consent).

- `<ConsentProvider config initialCookie>` — client provider; pass the server-read cookie for a flash-free first render.
- `useConsent()`, `useCategory(key)`, `useHasConsent(expr)` — state and actions.
- `<ConsentGate category="marketing" fallback={…}>` — render only when granted.
- `<ConsentModeScript config cookie />` — inline Google Consent Mode v2 defaults for `<head>` (Server Component friendly).
- `<ManageConsentButton />` — reopen the preferences dialog from the footer.
- `@payload-solutions/consent-react/next` — `readConsent(await cookies(), config)` for Server Components and route handlers.

UI: install the shadcn registry block, which copies a banner, a preferences dialog and a footer link into your project:

```bash
npx shadcn@latest add https://payload.solutions/r/consent-banner.json
```

The source of that block lives in `registry/` of this package.

MIT © Payload Solutions.
