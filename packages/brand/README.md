# @payload-solutions/brand

The shared brand system for the three sibling sites: payload.solutions, payloadstack.com and payloadclock.com. One mark, one palette, one accent, square corners everywhere. Only the word after "Payload" changes.

## What is in here

| Export | Contents |
| --- | --- |
| `@payload-solutions/brand` | `brands` registry (names, domains, taglines, docs URLs), trademark attribution strings, `NPX_COMMAND`, and the React logo components |
| `@payload-solutions/brand/logos` | `<Mark />` (the shared icon, fills with `currentColor`) and `<Logo brand="stack" />` (mark + live-text wordmark) |
| `@payload-solutions/brand/tokens.css` | CSS custom properties for both themes |
| `@payload-solutions/brand/tailwind.css` | Tailwind v4 `@theme` mapping, base styles and a few utilities. Imports `tokens.css` |
| `@payload-solutions/brand/assets/*` | Static SVG marks for favicons and OG images |

## Usage (Next.js app)

```css
/* app/globals.css */
@import 'tailwindcss';
@import '@payload-solutions/brand/tailwind.css';
```

```tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Logo, brands, PAYLOAD_TRADEMARK_ATTRIBUTION } from '@payload-solutions/brand'

// The fonts set --font-geist-sans / --font-geist-mono, which tokens.css picks up.
<html className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

Add `@payload-solutions/brand` to `transpilePackages` in `next.config.ts`; the package ships TypeScript source, not a build.

## Rules

- One accent (burnt orange) across every page and every brand. Do not introduce a second accent.
- Radius is 0. No rounded buttons, cards or inputs.
- Light or dark follows the visitor's system setting; the page never flips theme between sections.
- Neutrals are off-black (`#0a0a0a`) and off-white (`#fafafa`), never pure.
- Every footer renders `PAYLOAD_TRADEMARK_ATTRIBUTION` and `INDEPENDENCE_NOTICE` verbatim.
