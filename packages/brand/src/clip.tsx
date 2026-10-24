'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type ClipId, clips, clipUrl } from './clips'
import { useReducedMotionSafe } from './reduced-motion'

export interface ClipProps {
  id: ClipId
  className?: string
  /**
   * Play muted while at least half of it is on screen, pause when it leaves. Off under
   * prefers-reduced-motion and Save-Data, where the poster waits for a click instead.
   */
  autoPlay?: boolean
}

/**
 * One campaign video in the site frame: poster first, nothing downloaded until it is near the
 * viewport, then muted inline playback that loops before the X outro card (`clips[id].end`).
 * A paused-by-hand clip stays paused when it scrolls back in. Controls are a play/pause
 * button, a seek bar in the entity accent, the time and fullscreen.
 *
 * Changing `id` swaps the source in place, which is how a tabbed gallery drives it.
 */
export function Clip({ id, className, autoPlay = true }: ClipProps) {
  const clip = clips[id]
  const frameRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedByUser = useRef(false)
  const inView = useRef(false)
  const reducedMotion = useReducedMotionSafe()

  const [src, setSrc] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(clip.start)
  /** False until the first play; the big play button owns the frame until then. */
  const [hasStarted, setHasStarted] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  /** Play as soon as the current source is attached. */
  const wantsPlay = useRef(false)

  const canAutoPlay = autoPlay && !reducedMotion && !prefersSaveData()

  const play = useCallback(() => {
    wantsPlay.current = true
    const video = videoRef.current
    // The source is attached on the next render; the [src] effect below starts playback.
    if (!video || !video.getAttribute('src')) setSrc(clipUrl(id))
    // A rejected play() (autoplay policy, a source swapped under it) leaves the poster and the
    // play button up, which is the right fallback.
    else void video.play().catch(() => {})
  }, [id])

  useEffect(() => {
    const video = videoRef.current
    if (video && src && wantsPlay.current) void video.play().catch(() => {})
  }, [src])

  // Fetch when close, play while at least half visible, pause when it leaves.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setSrc((current) => current ?? clipUrl(id))
      },
      { rootMargin: '400px 0px' },
    )
    const visible = new IntersectionObserver(
      ([entry]) => {
        inView.current = Boolean(entry?.isIntersecting)
        if (inView.current) {
          if (canAutoPlay && !pausedByUser.current) play()
        } else {
          wantsPlay.current = false
          videoRef.current?.pause()
        }
      },
      { threshold: 0.5 },
    )
    if (canAutoPlay) near.observe(frame)
    visible.observe(frame)
    return () => {
      near.disconnect()
      visible.disconnect()
    }
  }, [canAutoPlay, id, play])

  // A new id swaps the source and starts from the top. It keeps playing if the previous clip
  // was playing (a gallery tab click), or if it would have autoplayed anyway.
  const previousId = useRef(id)
  useEffect(() => {
    if (previousId.current === id) return
    previousId.current = id
    const wasPlaying = Boolean(videoRef.current && !videoRef.current.paused)
    pausedByUser.current = false
    wantsPlay.current = wasPlaying || (inView.current && canAutoPlay)
    setHasFailed(false)
    setHasStarted(false)
    setTime(clips[id].start)
    setSrc(clipUrl(id))
  }, [id, canAutoPlay])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      pausedByUser.current = false
      play()
    } else {
      pausedByUser.current = true
      video.pause()
    }
  }

  const onTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    if (video.currentTime >= clip.end || video.currentTime < clip.start) {
      video.currentTime = clip.start
      if (video.paused && !pausedByUser.current) void video.play().catch(() => {})
    }
    setTime(Math.min(Math.max(video.currentTime, clip.start), clip.end))
  }

  // Skip the hook card before the first frame is shown.
  const onLoadedMetadata = () => {
    const video = videoRef.current
    if (video && video.currentTime < clip.start) video.currentTime = clip.start
  }

  const seek = (value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    setTime(value)
  }

  const fullscreen = () => {
    const frame = frameRef.current
    if (!frame) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.requestFullscreen?.().catch(() => {})
  }

  return (
    <div
      ref={frameRef}
      className={`group/clip relative aspect-video overflow-hidden border border-border bg-surface [&:fullscreen]:border-0 [&:fullscreen]:bg-black ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        src={src ?? undefined}
        poster={clip.poster.src}
        muted
        playsInline
        preload="none"
        aria-label={clip.alt}
        onClick={toggle}
        onPlay={() => {
          setIsPlaying(true)
          setHasStarted(true)
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onError={() => setHasFailed(Boolean(src))}
        className="absolute inset-0 block size-full cursor-pointer object-cover [:fullscreen_&]:object-contain"
      />

      {/* Big play button until the first play: the whole poster is the target. */}
      {!hasStarted && !hasFailed ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Play video: ${clip.alt}`}
          className="absolute inset-0 grid place-items-center bg-black/25 transition-colors duration-150 hover:bg-black/10"
        >
          <span className="grid size-16 place-items-center border border-white/30 bg-black/70 text-white backdrop-blur-sm transition-transform duration-150 group-hover/clip:scale-105">
            <PlayGlyph />
          </span>
        </button>
      ) : null}

      {hasFailed ? (
        <p className="absolute inset-x-0 bottom-0 bg-black/75 px-4 py-2 font-mono text-[0.6875rem] text-white/80">
          The video could not be loaded.
        </p>
      ) : null}

      {/* Controls: hidden before the first play (the big button owns the frame), faded while
          playing until hovered or focused, up while paused mid-clip. */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 text-white transition-opacity duration-200 ${
          !hasStarted
            ? 'pointer-events-none opacity-0'
            : isPlaying
              ? 'opacity-0 focus-within:opacity-100 group-hover/clip:opacity-100'
              : 'opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="grid size-7 shrink-0 place-items-center"
        >
          {isPlaying ? <PauseGlyph /> : <PlayGlyph small />}
        </button>
        <input
          type="range"
          min={clip.start}
          max={clip.end}
          step={0.1}
          value={time}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatTime(time - clip.start)} of ${formatTime(clip.end - clip.start)}`}
          className="h-1 min-w-0 flex-1 cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-white/80">
          {formatTime(time - clip.start)} / {formatTime(clip.end - clip.start)}
        </span>
        <button
          type="button"
          onClick={fullscreen}
          aria-label="Fullscreen"
          className="grid size-7 shrink-0 place-items-center"
        >
          <FullscreenGlyph />
        </button>
      </div>
    </div>
  )
}

function prefersSaveData(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(connection?.saveData)
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function PlayGlyph({ small = false }: { small?: boolean }) {
  const size = small ? 14 : 20
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  )
}

function PauseGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
    </svg>
  )
}

function FullscreenGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
    </svg>
  )
}
