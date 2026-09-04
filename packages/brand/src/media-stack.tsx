import type { ReactNode } from 'react'
import { Crosshairs } from './crosshairs'
import { Parallax } from './parallax'

export interface MediaStackProps {
  /** The rear screenshot, top left. */
  back: ReactNode
  /** The front screenshot, bottom right, over the rear one. */
  front: ReactNode
  className?: string
  /** Width of the rear layer as a fraction of the stage. */
  backWidth?: number
  /** Width of the front layer as a fraction of the stage. */
  frontWidth?: number
  /** Stage aspect ratio as CSS `aspect-ratio`. */
  aspect?: string
  /** Hatched desk behind the layers. Turn off over an AmbientBackdrop, which has its own floor. */
  texture?: boolean
}

/**
 * Two screenshots layered with an offset, on a hatched desk framed by hairlines. On scroll
 * the rear layer lags and the front layer leads, so the pair separates: the depth the offset
 * implies becomes visible. Static under reduced motion. Pass `next/image` elements (or
 * ThemedImage) with `sizes` set; the stack only positions them.
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
  return (
    <div className={`relative ${className ?? ''}`}>
      <div
        className={`relative border border-border ${texture ? 'scanline' : ''}`}
        style={{ aspectRatio: aspect }}
      >
        <Crosshairs />
        <Parallax
          speed={0.1}
          className="absolute left-[4%] top-[6%] border border-border bg-surface"
          style={{ width: `${backWidth * 100}%` }}
        >
          {back}
        </Parallax>
        <Parallax
          speed={-0.06}
          className="absolute bottom-[6%] right-[4%] border border-border-strong bg-surface"
          style={{
            width: `${frontWidth * 100}%`,
            boxShadow: '0 40px 80px -30px rgba(0, 0, 0, 0.55)',
          }}
        >
          {front}
        </Parallax>
      </div>
    </div>
  )
}
