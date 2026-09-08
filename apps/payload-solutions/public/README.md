# public

Static files served from the site root.

## crt.gif

The animated CRT grain tile behind `--crt-image` in `@payload-solutions/brand/tokens.css`,
painted by the shared `crt` utility and used by:

- `AmbientBackdrop` — the pinned layer behind the hero and the dark band
- `CrtGrain` — the page-level layer behind the sections below it

The tile is screened onto the page rather than overlaid, because `overlay` leaves pure black
untouched and the black is the whole point. The file is therefore bright, near-white speckle,
and `--crt-opacity` (0.02, one value for both themes) — not the file — sets how far it
lifts. It is deliberately just under the --surface step so the first elevation step survives.

It is optional by construction. With no file here that layer is not painted and the static
SVG turbulence of the `noise` utility carries the surface on its own, so the site is correct
either way. The same happens under `prefers-reduced-motion: reduce`, which sets
`--crt-image: none`.

Wants: a small, seamlessly tiling grayscale loop, tiled at its own pixel size
(`--crt-size: auto`). Keep it to a few tens of KB — it is decorative and sits on the critical
path of the hero.
