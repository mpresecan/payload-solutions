# @payload-solutions/consent-core

Framework-agnostic client core of [Payload Consent](https://payload.solutions/docs/plugins/payload-consent): a consent state machine, the `pl-consent` cookie codec, jurisdiction models (opt-in / opt-out / notice / none), Google Consent Mode v2 bridge, Global Privacy Control handling and a consent-gated script loader. Zero dependencies, ~6 kB gzipped, `useSyncExternalStore`-compatible.

```ts
import { createConsentStore, attachLoader } from '@payload-solutions/consent-core'

const config = await fetch('/api/consent/config').then((r) => r.json())
const store = createConsentStore({ config })
attachLoader(store, config.trackers)

store.subscribe((state) => render(state))
store.has('analytics')      // boolean
store.acceptAll()           // writes the cookie, records the decision, loads scripts
```

`resolveConsent(cookie, config)` is the same pure function the Payload plugin uses on the server, so both sides always agree on what is granted.

MIT © Payload Solutions.
