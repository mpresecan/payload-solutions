# public

Static files served from the site root.

## crt.gif

The animated CRT grain tile behind `--crt-image` in `@payload-solutions/brand/tokens.css`,
painted by the shared `crt` utility and used by:

- `AmbientBackdrop` — the pinned layer behind the hero on payloadstack.com
- `VideoBackdrop` — multiplied (not screened) over the hero video on payload.solutions
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

## hero-poster.webp

The first frame of the hero video (`https://cdn.payload.solutions/hero-1080.mp4`), 1920x1080,
~27KB. `HeroBackdrop` in `src/sections/hero.tsx` preloads it and passes it to `VideoBackdrop`
as the `<video>` poster, so the hero is never an empty black frame while the MP4 buffers, and
it is the still that replaces the video entirely under `prefers-reduced-motion: reduce`.

If the video is re-cut, re-export this from frame 0 of the new loop
(`ffmpeg -i hero-1080.mp4 -frames:v 1 -c:v libwebp -quality 80 hero-poster.webp`), or the
hand-off from still to motion will jump.
