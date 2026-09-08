/**
 * The CRT grain as a page-level layer.
 *
 * The hero band already gets its grain from AmbientBackdrop, but that layer is pinned to the
 * viewport and fades out with the band, so everything below it — the product wall, the
 * plugins, the roadmap, contact — sits on flat colour. This puts the same tile behind those
 * sections so the texture runs the length of the page instead of stopping at the fold.
 *
 * Drop it as the first child of the opaque, positioned wrapper the lower sections live in
 * (`relative z-10 bg-bg`). That wrapper is a stacking context, so `-z-10` keeps the layer
 * inside it: painted over the wrapper's own background, under every section's background and
 * all of its content. Fixed rather than absolute so the tile is only ever a viewport's worth
 * of animation no matter how long the page runs, and so the grain sits on the glass rather
 * than travelling with the copy.
 *
 * Texture comes from the `crt` utility, so this layer inherits its screen blend and its
 * missing-file and reduced-motion behaviour for free: no file, or reduced motion, and
 * nothing is painted here at all.
 */
export function CrtGrain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`crt pointer-events-none fixed inset-0 -z-10 ${className ?? ''}`}
    />
  )
}
