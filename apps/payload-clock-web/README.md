# payloadclock.com

Marketing site for **Payload Clock** — the hosted service that calls a serverless Payload
deployment's `/api/payload-jobs/run` endpoint on schedule.

Static Next.js, the same shape as `apps/payload-stack-web`: every layout primitive, token and
motion piece comes from `@payload-solutions/brand`, so the three sites cannot drift. The only
things that live here are this product's sections and its own visuals.

```bash
pnpm --filter @payload-solutions/clock-web dev   # http://localhost:3300
```

## What is local to this site

| File | Why it is not in `packages/brand` |
| --- | --- |
| `src/components/clock-dial.tsx` | Payload Clock's signature visual — the counterpart to Stack's IsoStack. |
| `src/components/ping-beams.tsx` | The architecture diagram. Carried over from the old MagicUI `AnimatedBeam`, redrawn in hairlines. |
| `src/components/particles.tsx` | Carried over from the old site's MagicUI particle field, re-cut to one accent. |
| `src/components/globe.tsx` | The cobe globe from the old site, re-coloured to the brass accent. |
| `src/components/border-beam.tsx` | Carried over from MagicUI, rewritten with no dependency and one accent. |
| `src/components/text-shimmer.tsx` | Carried over; the badge above the headline. |

Design decisions, the palette, the four-column grid and the footer are documented in project
memory (`project_site_design.md`) and apply here unchanged. The product itself is specified in
`notes/payload-clock-spec.md`.
