'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type ClipId, clipEntry, clipUrl } from './clips'
import { useReducedMotionSafe } from './reduced-motion'

export interface ClipProps {
  id: ClipId
  className?: string
  /**
   * Play muted while at least half of it is on screen, pause when it leaves. Off under
   * prefers-reduced-motion and Save-Data, where the poster waits for a click instead. Films
   * (`hasAudio`) never autoplay this way.
   */
  autoPlay?: boolean
  /**
   * Start at once, with sound for a film. For a player opened by a click (the hero's film
   * modal). If the browser refuses sound outside the click, it plays muted and the mute button
   * pulses so the visitor can turn sound on.
   */
  playOnMount?: boolean
  /**
   * Draw the site frame (hairline border and surface fill). Off when a parent owns the frame
   * and slides clips through it, so two borders do not travel past each other.
   */
  framed?: boolean
  /**
   * Fetch and start the clip at once instead of waiting for the viewport, so it can be
   * playing before it is shown. For a gallery that holds the next clip off stage until
   * `onReady`. Read on mount only; ignored where the clip would not autoplay anyway.
   */
  preload?: boolean
  /**
   * Called once when the clip is worth showing: its first frame is on screen and moving. Where
   * it will not autoplay (films, reduced motion, Save-Data) the poster is the intended state,
   * so it fires on mount. Also fires on a load error, so a caller never waits on a dead file.
   */
  onReady?: () => void
  /**
   * Called when the clip has played to its end, instead of looping: the clip stops on its last
   * frame and this fires `FINISH_HOLD_MS` later. Only reaching the end counts, so a pause or a
   * seek back never triggers it, and a seek or a play inside the hold cancels it. For a gallery
   * that advances to the next clip. Films ignore it.
   */
  onFinish?: () => void
}

/** The beat a finished clip holds its last frame before `onFinish` fires. */
const FINISH_HOLD_MS = 500

/**
 * One video in the site frame, from cdn.payload.solutions.
 *
 * Campaign clips: poster first, nothing downloaded until near the viewport, then muted inline
 * playback trimmed to `start`–`end` (no X hook or outro card) and looping. A paused-by-hand
 * clip stays paused when it scrolls back in.
 *
 * Films (`hasAudio`): click to play with sound, a mute button, stop at the end with a replay
 * button. With no poster, the first frame is shown from preloaded metadata.
 *
 * Controls: play/pause, a seek bar in the entity accent, the time, mute (films), fullscreen.
 * Changing `id` swaps the source in place, which is how a tabbed gallery drives it.
 */
export function Clip({
  id,
  className,
  autoPlay = true,
  playOnMount = false,
  framed = true,
  preload = false,
  onReady,
  onFinish,
}: ClipProps) {
  const clip = clipEntry(id)
  const isFilm = Boolean(clip.hasAudio)
  const start = clip.start ?? 0
  const frameRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedByUser = useRef(false)
  const inView = useRef(false)
  const reducedMotion = useReducedMotionSafe()

  const canAutoPlay = autoPlay && !isFilm && !reducedMotion && !prefersSaveData()
  // Read once: flipping `preload` off after the reveal must not reset anything.
  const [isPreloading] = useState(preload && canAutoPlay)

  // A film without a poster needs its source up front so the browser can paint a frame.
  const eagerSrc = playOnMount || isPreloading || (isFilm && !clip.poster)
  const [src, setSrc] = useState<string | null>(eagerSrc ? clipUrl(id) : null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(start)
  const [duration, setDuration] = useState<number | null>(null)
  /** False until the first play, and again after a film ends; the big button owns the frame. */
  const [hasStarted, setHasStarted] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  /** The first frame is decoded. Without a poster the video fades in from here. */
  const [hasFrame, setHasFrame] = useState(false)
  /** A film played to the end; the big button offers a replay. */
  const [hasEnded, setHasEnded] = useState(false)
  const [isMuted, setIsMuted] = useState(!isFilm)
  /** The browser refused sound; the mute button asks for a click. */
  const [needsSoundClick, setNeedsSoundClick] = useState(false)
  /** Play as soon as the current source is attached. */
  const wantsPlay = useRef(playOnMount || isPreloading)

  const end = clip.end ?? duration ?? 0

  const onReadyRef = useRef(onReady)
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onReadyRef.current = onReady
    onFinishRef.current = onFinish
  })
  const stopsAtEnd = Boolean(onFinish) && !isFilm

  const finishTimer = useRef<number | null>(null)
  const cancelFinish = useCallback(() => {
    if (finishTimer.current === null) return
    window.clearTimeout(finishTimer.current)
    finishTimer.current = null
  }, [])
  useEffect(() => cancelFinish, [cancelFinish])

  // Reached the end: hold the last frame, then hand over. Idempotent while the hold runs.
  const finish = useCallback((video: HTMLVideoElement) => {
    if (finishTimer.current !== null) return
    video.pause()
    setTime(video.currentTime)
    finishTimer.current = window.setTimeout(() => {
      finishTimer.current = null
      onFinishRef.current?.()
    }, FINISH_HOLD_MS)
  }, [])
  const hasSignalledReady = useRef(false)
  const signalReady = useCallback(() => {
    if (hasSignalledReady.current) return
    hasSignalledReady.current = true
    onReadyRef.current?.()
  }, [])

  useEffect(() => {
    if (!canAutoPlay) signalReady()
  }, [canAutoPlay, signalReady])

  // 'playing' fires before the frame is composited; wait for the frame itself where the
  // browser can say so, else one animation frame.
  const onPlaying = () => {
    const video = videoRef.current
    if (!video || hasSignalledReady.current) return
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => signalReady())
    } else {
      requestAnimationFrame(() => signalReady())
    }
  }

  const startPlayback = useCallback((video: HTMLVideoElement) => {
    video.play().catch((error: unknown) => {
      // Sound refused outside a gesture: play muted and offer the sound button instead.
      if (error instanceof DOMException && error.name === 'NotAllowedError' && !video.muted) {
        video.muted = true
        setIsMuted(true)
        setNeedsSoundClick(true)
        void video.play().catch(() => {})
      }
      // Anything else leaves the poster and the play button up, which is the right fallback.
    })
  }, [])

  const play = useCallback(() => {
    wantsPlay.current = true
    const video = videoRef.current
    // The source is attached on the next render; the [src] effect below starts playback.
    if (!video || !video.getAttribute('src')) setSrc(clipUrl(id))
    else startPlayback(video)
  }, [id, startPlayback])

  useEffect(() => {
    const video = videoRef.current
    if (video && src && wantsPlay.current) startPlayback(video)
  }, [src, startPlayback])

  // 'timeupdate' only fires about four times a second, so a clip that stops at a trimmed `end`
  // watches every frame while it plays: the hold then starts at the end, not up to 250ms after.
  const trimmedEnd = clip.end
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isPlaying || !stopsAtEnd || trimmedEnd === undefined) return
    let isStopped = false
    let handle = 0
    const hasFrameCallback = typeof video.requestVideoFrameCallback === 'function'
    const check = () => {
      if (isStopped) return
      if (video.currentTime >= trimmedEnd) finish(video)
      else schedule()
    }
    const schedule = () => {
      handle = hasFrameCallback
        ? video.requestVideoFrameCallback(check)
        : requestAnimationFrame(check)
    }
    schedule()
    return () => {
      isStopped = true
      if (hasFrameCallback) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [isPlaying, stopsAtEnd, trimmedEnd, finish])

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
        } else if (!playOnMount) {
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
  }, [canAutoPlay, id, play, playOnMount])

  // A new id swaps the source and starts from the top. It keeps playing if the previous clip
  // was playing (a gallery tab click), or if it would have autoplayed anyway.
  const previousId = useRef(id)
  useEffect(() => {
    if (previousId.current === id) return
    previousId.current = id
    cancelFinish()
    const wasPlaying = Boolean(videoRef.current && !videoRef.current.paused)
    pausedByUser.current = false
    wantsPlay.current = wasPlaying || (inView.current && canAutoPlay)
    setHasFailed(false)
    setHasStarted(false)
    setHasFrame(false)
    setDuration(null)
    setTime(clipEntry(id).start ?? 0)
    setSrc(clipUrl(id))
  }, [id, canAutoPlay, cancelFinish])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      pausedByUser.current = false
      // Play on a finished clip is a replay, from the top.
      if (stopsAtEnd && end > 0 && video.currentTime >= end - 0.05) video.currentTime = start
      // A click is a gesture: a film gets its sound now, unless the visitor muted it.
      if (isFilm && !needsSoundClick) video.muted = isMuted
      play()
    } else {
      pausedByUser.current = true
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
    setNeedsSoundClick(false)
  }

  const onTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    if (!isFilm && clip.end !== undefined && video.currentTime >= clip.end) {
      if (stopsAtEnd) {
        finish(video)
        return
      }
      video.currentTime = start
      if (video.paused && !pausedByUser.current) void video.play().catch(() => {})
    } else if (video.currentTime < start) {
      video.currentTime = start
    }
    setTime(Math.max(video.currentTime, start))
  }

  const onLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration)
    // Skip the hook card before the first frame is shown.
    if (video.currentTime < start) video.currentTime = start
  }

  // Films end; campaign clips without an `end` loop on their own.
  const onEnded = () => {
    const video = videoRef.current
    if (!video) return
    if (isFilm) {
      setHasEnded(true)
      setHasStarted(false)
      setTime(start)
      video.currentTime = start
    } else if (stopsAtEnd) {
      finish(video)
    } else {
      video.currentTime = start
      void video.play().catch(() => {})
    }
  }

  const seek = (value: number) => {
    const video = videoRef.current
    if (!video) return
    cancelFinish()
    video.currentTime = value
    setTime(value)
  }

  const fullscreen = () => {
    const frame = frameRef.current
    if (!frame) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (frame.requestFullscreen) void frame.requestFullscreen().catch(() => {})
    // iOS Safari has no element fullscreen, only the video's own.
    else (videoRef.current as WebkitVideo | null)?.webkitEnterFullscreen?.()
  }

  const length = Math.max(end - start, 0)

  return (
    <div
      ref={frameRef}
      className={`group/clip relative aspect-video overflow-hidden ${
        framed ? 'border border-border bg-surface' : ''
      } [&:fullscreen]:border-0 [&:fullscreen]:bg-black ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        src={src ? (isFilm && !clip.poster && !playOnMount ? `${src}#t=0.1` : src) : undefined}
        poster={clip.poster?.src}
        muted={isMuted}
        playsInline
        preload={isPreloading ? 'auto' : eagerSrc ? 'metadata' : 'none'}
        aria-label={clip.alt}
        onClick={toggle}
        onPlay={() => {
          cancelFinish()
          setIsPlaying(true)
          setHasStarted(true)
          setHasEnded(false)
        }}
        onPlaying={onPlaying}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onLoadedData={() => setHasFrame(true)}
        onEnded={onEnded}
        onError={() => {
          setHasFailed(Boolean(src))
          if (src) signalReady()
        }}
        // A film is shown whole whatever its aspect; a screen recording fills the frame.
        className={`absolute inset-0 block size-full cursor-pointer transition-opacity duration-500 ease-out ${
          isFilm ? 'bg-black object-contain' : 'object-cover [:fullscreen_&]:object-contain'
        } ${clip.poster || hasFrame ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Big play button until the first play (and after a film ends): the whole frame is the
          target. A player opened by a click starts by itself, so it only gets the replay. */}
      {!hasStarted && !hasFailed && (!playOnMount || hasEnded) ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={`${hasEnded ? 'Replay' : 'Play'} video: ${clip.alt}`}
          className="absolute inset-0 grid place-items-center bg-black/25 transition-colors duration-150 hover:bg-black/10"
        >
          <span className="flex items-center gap-3 border border-white/30 bg-black/70 p-5 text-white backdrop-blur-sm transition-transform duration-150 group-hover/clip:scale-105">
            <PlayGlyph />
            {isFilm ? (
              <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
                {hasEnded ? 'Replay' : 'Play'}
                {duration ? ` · ${formatTime(length)}` : ''}
              </span>
            ) : null}
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
            : isPlaying && !needsSoundClick
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
          min={start}
          max={end || start + 1}
          step={0.1}
          value={time}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatTime(time - start)} of ${formatTime(length)}`}
          className="h-1 min-w-0 flex-1 cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-white/80">
          {formatTime(time - start)} / {formatTime(length)}
        </span>
        {isFilm ? (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Turn sound on' : 'Mute'}
            className={`grid shrink-0 place-items-center ${
              needsSoundClick
                ? 'h-7 gap-1.5 border border-white/40 px-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] motion-safe:animate-pulse'
                : 'size-7'
            }`}
          >
            {needsSoundClick ? (
              <span className="flex items-center gap-1.5">
                <SoundGlyph isMuted />
                Sound on
              </span>
            ) : (
              <SoundGlyph isMuted={isMuted} />
            )}
          </button>
        ) : null}
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

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

function prefersSaveData(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(connection?.saveData)
}

function formatTime(seconds: number): string {
  const whole = Math.max(Math.floor(seconds), 0)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function PlayGlyph({ small = false }: { small?: boolean }) {
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

function SoundGlyph({ isMuted }: { isMuted: boolean }) {
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
      <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5z" fill="currentColor" stroke="none" />
      {isMuted ? (
        <path d="M11 6l4 4M15 6l-4 4" />
      ) : (
        <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" />
      )}
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
