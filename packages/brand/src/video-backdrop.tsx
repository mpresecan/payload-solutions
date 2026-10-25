'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotionSafe } from './reduced-motion'

export type VideoBackdropSource = {
  src: string
  /** MIME type, with codecs when it matters, e.g. `video/mp4; codecs="av01.0.08M.10"`. */
  type: string
  /** Optional media query, e.g. `(max-width: 767px)` for a lighter phone encode. */
  media?: string
}

/**
 * The hero's background video, pinned to the viewport the way payloadcms.com pins theirs: the
 * band it sits in (hero + statement) is transparent, so the video runs behind both, and the
 * opaque sections after the band slide over it like a curtain.
 *
 * Layers, bottom to top, the first three lifted from payloadcms.com's BackgroundGradient:
 *
 * 1. The video: muted, inline, looping, `object-fit: cover`, fading in over 2s.
 * 2. The CRT tile, MULTIPLIED at 256px. This is the one place the tile multiplies instead of
 *    screening (see the `crt` utility): over a lit video it should darken into scanlines, and
 *    over black multiply is a no-op, so it cannot lift the page.
 * 3. An inset box-shadow in --bg that closes every edge, the top hardest, so the header sits
 *    on black and there is no seam at its bottom border.
 * 4. A copy scrim (ours, not theirs). Their video is a dim glass loop; ours has bright streaks
 *    that measured 1.4:1 under white headline text. The scrim darkens the first lattice column
 *    from lg (horizontal) and the top of the frame below lg (vertical, where the copy spans
 *    the width), and leaves columns two to four, where the hero visual sits, untouched.
 *    Measured worst case behind the copy with it: 10.4:1 at 1440, 14:1 on a phone.
 * 5. A top vignette: solid --bg under the header easing out over ~26rem, so the video dissolves
 *    into the header rather than meeting its bottom border.
 *
 * Like AmbientBackdrop it fades out over the last stretch of its band, so nothing pinned can
 * show through a transparent footer, and it pauses the video once the band is off screen.
 * Reduced motion: no video element at all, the poster as a still, absolute and static.
 *
 * Place it as the first child of a ThemeBand; follow the band with `relative z-10 bg-bg`.
 */
export function VideoBackdrop({
  sources,
  poster,
  playbackRate = 1,
  className,
}: {
  sources: VideoBackdropSource[]
  /** First frame of the loop, shown until the video plays and as the reduced-motion still. */
  poster: string
  /** Playback speed for the background video. */
  playbackRate?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduce = useReducedMotionSafe()
  const { scrollY } = useScroll()
  const [fade, setFade] = useState<[number, number]>([0, 640])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const band = ref.current?.parentElement
    if (!band) return
    const measure = () => {
      const vh = window.innerHeight
      const start = Math.max(0, band.offsetHeight - vh)
      setFade([start, start + vh * 0.4])
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(band)
    window.addEventListener('resize', measure)

    // A fixed layer is always "in view", so watch the band instead: pause while it is gone.
    const io = new IntersectionObserver(([entry]) => {
      const video = videoRef.current
      if (!video) return
      if (entry?.isIntersecting) void video.play().catch(() => {})
      else video.pause()
    })
    io.observe(band)

    return () => {
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const opacity = useTransform(scrollY, fade, [1, 0])

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={`video-backdrop pointer-events-none inset-x-0 top-0 z-[-2] h-dvh overflow-hidden bg-bg ${reduce ? 'absolute' : 'fixed'} ${className ?? ''}`}
      style={reduce ? undefined : { opacity }}
    >
      {reduce ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative still, no layout to optimise
        <img src={poster} alt="" className="video-backdrop__media" />
      ) : (
        <video
          ref={videoRef}
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = playbackRate
          }}
          className="video-backdrop__media"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={poster}
          disablePictureInPicture
          disableRemotePlayback
        >
          {sources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} media={s.media} />
          ))}
        </video>
      )}
      <div className="video-backdrop__crt absolute inset-0" />
      <div className="video-backdrop__scrim absolute inset-0" />
      <div className="video-backdrop__edge absolute inset-0" />
      <div className="video-backdrop__vignette absolute inset-0" />
    </motion.div>
  )
}
