import { Clip } from '@payload-solutions/brand/clip'
import type { ClipId } from '@payload-solutions/brand/clips'

type DocsClipProps = {
  /** A key of `clips` in packages/brand/src/clips.ts. */
  id: ClipId
  /** Optional line under the video. */
  caption?: string
}

/**
 * A campaign video in docs: a real recording of the feature the page describes, from
 * cdn.payload.solutions. Muted, plays while on screen, loops before the X outro card.
 * Use it near the top of a page, before the reference material, as the "this is what it
 * looks like" moment — the Screenshot component covers the individual screens.
 */
export function DocsClip({ id, caption }: DocsClipProps) {
  return (
    <figure className="not-prose my-6">
      <Clip id={id} />
      {caption ? <figcaption className="mt-2 text-sm text-fg-muted">{caption}</figcaption> : null}
    </figure>
  )
}
