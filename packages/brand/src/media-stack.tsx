import type { CSSProperties, ReactNode } from 'react'
import { Crosshairs } from './crosshairs'
import { Parallax } from './parallax'

export interface MediaStackProps {
  /** The rear screenshot, top left. */
  back: ReactNode
  /** The front screenshot, bottom right, over the rear one. */
  front: ReactNode
  className?: string
  /** Width of the rear layer as a fraction of the stage (md and up). */
  backWidth?: number
  /** Width of the front layer as a fraction of the stage (md and up). */
  frontWidth?: number
  /** Stage aspect ratio as CSS `aspect-ratio` (md and up). */
  aspect?: string
  /** Hatched desk behind the layers. Turn off over an AmbientBackdrop, which has its own floor. */
  texture?: boolean
}

/**
 * Two screenshots layered with an offset, on a hatched desk framed by hairlines. On scroll
 * the rear layer lags and the front layer leads, so the pair separates: the depth the offset
 * implies becomes visible. Static under reduced motion. Pass `next/image` elements (or
 * ThemedImage) with `sizes` set; the stack only positions them.
 *
 * Below `md` the stage turns portrait and both layers span almost the full width, one above
 * the other with a small overlap, so each screenshot stays legible on a phone.
 */
export function MediaStack({
  back,
  front,
  className,
  backWidth = 0.8,
  frontWidth = 0.68,
  aspect = '16 / 10',
  texture = true,
}: MediaStackProps) {
  const vars = {
    '--stage-aspect': aspect,
    '--back-w': `${backWidth * 100}%`,
    '--front-w': `${frontWidth * 100}%`,
  } as CSSProperties

  return (
    <div className={`relative ${className ?? ''}`} style={vars}>
      <div
        className={`relative aspect-[4/5] md:aspect-(--stage-aspect) border border-border ${texture ? 'scanline' : ''}`}
      >
        <Crosshairs />
        <Parallax
          speed={0.1}
          className="absolute left-[4%] top-[6%] w-[90%] border border-border bg-surface md:w-(--back-w)"
        >
          {back}
        </Parallax>
        <Parallax
          speed={-0.06}
          className="absolute bottom-[6%] right-[4%] w-[90%] border border-border-strong bg-surface md:w-(--front-w)"
          style={{ boxShadow: '0 40px 80px -30px rgba(0, 0, 0, 0.55)' }}
        >
          {front}
        </Parallax>
      </div>
    </div>
  )
}
