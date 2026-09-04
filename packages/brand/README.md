# @payload-solutions/brand

The shared brand system for the three sibling sites: payload.solutions, payloadstack.com and payloadclock.com. One mark, one palette, one accent, square corners everywhere. Only the word after "Payload" changes.

## What is in here

| Export                                      | Contents                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@payload-solutions/brand`                  | `brands` registry (names, domains, taglines, docs URLs), trademark attribution strings, `NPX_COMMAND`, and the React logo components |
| `@payload-solutions/brand/logos`            | `<Mark />` (the shared icon, fills with `currentColor`) and `<Logo brand="stack" />` (mark + live-text wordmark)                     |
| `@payload-solutions/brand/tokens.css`       | CSS custom properties for both themes                                                                                                |
| `@payload-solutions/brand/tailwind.css`     | Tailwind v4 `@theme` mapping, base styles and a few utilities. Imports `tokens.css`                                                  |
| `@payload-solutions/brand/assets/*`         | Static SVG marks for favicons and OG images, plus `assets/screens/` (real screenshots of the Payload Stack template, both themes)    |
| `@payload-solutions/brand/iso-stack`        | `<IsoStack />`, the isometric stack illustration used in both heroes                                                                 |
| `@payload-solutions/brand/screens`          | `screens`: typed registry of the screenshots (`{ light, dark, alt }` per screen)                                                     |
| `@payload-solutions/brand/themed-image`     | `<ThemedImage light dark alt />`: one `next/image` per theme, the tokens decide which shows                                          |
| `@payload-solutions/brand/theme-band`       | `<ThemeBand theme="dark">`: a section that keeps one theme whatever the page is set to                                               |
| `@payload-solutions/brand/use-header-theme` | `useHeaderTheme(ref)` and `<HeaderThemeSync />`: the sticky header takes the colour of the band under it                             |
| `@payload-solutions/brand/ambient-backdrop` | `<AmbientBackdrop />`: isometric floor, drifting light, sheen and grain, pinned behind the hero so the page slides over it           |
| `@payload-solutions/brand/grid-columns`     | `<GridColumns />`: hairlines at the content edges and column boundaries, behind everything                                           |
| `@payload-solutions/brand/parallax`         | `<Parallax speed>`: scroll-linked depth on Motion scroll values, static under reduced motion                                         |
| `@payload-solutions/brand/media-stack`      | `<MediaStack back front />`: two screenshots layered with an offset that separate on scroll                                          |
| `@payload-solutions/brand/crosshairs`       | `<Crosshairs />`: corner marks where a framed panel meets the grid                                                                   |
| `@payload-solutions/brand/reduced-motion`   | `useReducedMotionSafe()`: `prefers-reduced-motion` without hydration mismatches                                                      |

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

## Page composition

Both homepages open with one dark band and follow the visitor's theme from there:

```tsx
<SiteHeader />                       {/* contains <HeaderThemeSync /> */}
<main>
  <ThemeBand theme="dark" as="div" className="-mt-header pt-header">
    <AmbientBackdrop />              {/* fixed, negative z-index, fades as the band scrolls out */}
    <GridColumns />
    <Hero />                         {/* visual wrapped in <Parallax speed={-0.08}> */}
    ...
  </ThemeBand>
  <div className="relative z-10 bg-bg">   {/* opaque, slides over the backdrop */}
    <GridColumns />
    ...sections with <ThemedImage> and <MediaStack>
  </div>
</main>
```

Screenshots live in `assets/screens/` and are real captures of `templates/payload-stack` (1280x800, 2x, dark and light). When the template UI changes, recapture them rather than editing the images.

## Rules

- One accent (burnt orange) across every page and every brand. Do not introduce a second accent.
- Radius is 0. No rounded buttons, cards or inputs.
- Light or dark follows the visitor's system setting. The one exception is the opening `ThemeBand`, which is always dark; nothing else flips theme mid-page.
- Product visuals are real screenshots or real components, never mock UIs drawn from divs.
- Motion is transform and opacity only, and everything collapses to static under `prefers-reduced-motion`.
- Neutrals are off-black (`#0a0a0a`) and off-white (`#fafafa`), never pure.
- Every footer renders `PAYLOAD_TRADEMARK_ATTRIBUTION` and `INDEPENDENCE_NOTICE` verbatim.
