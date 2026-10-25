'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clip, PlayGlyph } from '@payload-solutions/brand/clip'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { cn } from '@/lib/cn'

/** closed → entering (in the top layer, at its start state) → open → leaving → closed */
type Phase = 'closed' | 'entering' | 'open' | 'leaving'

/** Must match the leave durations in the classes below. */
const LEAVE_MS = 240
const LEAVE_MS_REDUCED = 120

/**
 * The hero's "Watch the launch film" button and the modal it opens.
 *
 * Nothing is downloaded until the click (the layout only preconnects to the CDN). The modal is
 * a native <dialog> opened with showModal(), so the top layer, the focus trap and returning
 * focus to the button come from the browser. The player mounts with the dialog and unmounts
 * with it; it starts at once and with sound, because the click that opened it is the gesture
 * browsers ask for (it falls back to muted with a "Sound on" button when one refuses).
 *
 * Motion, all CSS transitions on `data-phase`:
 * - In: the backdrop fades and blurs in over 500ms while the stage rises 12px and scales from
 *   0.96 on an expo-out curve, so it decelerates into place instead of arriving. The video
 *   itself fades in once its first frame is decoded (Clip), so there is no black box that
 *   pops into a picture.
 * - Out: Escape, ×, or a click on the backdrop all run the same 240ms ease-in reverse, with
 *   the sound faded out alongside it, and only then close the dialog.
 * - The page scrollbar is hidden with its gutter kept, so nothing behind the modal shifts.
 * - Reduced motion: opacity only, shorter, no scale or travel.
 */
export function LaunchFilm({ className }: { className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<Phase>('closed')
  const reduceMotion = useReducedMotionSafe()

  // Into the top layer at the start state, then one frame later to the open state, so the
  // browser has a style to transition from.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || phase !== 'entering') return
    if (!dialog.open) dialog.showModal()
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase('open'))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [phase])

  // Lock the page while the dialog is up, keeping the scrollbar's gutter so nothing shifts.
  const isShown = phase !== 'closed'
  useEffect(() => {
    if (!isShown) return
    const root = document.documentElement
    const previous = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter }
    root.style.scrollbarGutter = 'stable'
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous.overflow
      root.style.scrollbarGutter = previous.gutter
    }
  }, [isShown])

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    setPhase((current) => (current === 'closed' || current === 'leaving' ? current : 'leaving'))
    const duration = reduceMotion ? LEAVE_MS_REDUCED : LEAVE_MS
    fadeOutSound(dialog.querySelector('video'), duration)
    window.setTimeout(() => dialog.close(), duration)
  }, [reduceMotion])

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase('entering')}
        aria-haspopup="dialog"
        className={cn('group inline-flex items-center gap-3.5 text-left', className)}
      >
        <span className="grid size-10 shrink-0 place-items-center border border-border-strong text-fg transition-colors duration-150 ease-standard group-hover:border-fg group-hover:bg-fg group-hover:text-bg group-focus-visible:border-fg group-focus-visible:bg-fg group-focus-visible:text-bg">
          <PlayGlyph small />
        </span>
        <span className="text-[0.9375rem] text-fg-muted transition-colors duration-150 group-hover:text-fg">
          Watch the launch film
        </span>
      </button>

      <dialog
        ref={dialogRef}
        data-phase={phase}
        aria-label="Payload Stack launch film"
        onClose={() => setPhase('closed')}
        // Escape: animate out instead of the browser's instant close.
        onCancel={(event) => {
          event.preventDefault()
          requestClose()
        }}
        // A click on the dialog box itself (not on its content) is a click on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose()
        }}
        className={cn(
          'group/modal m-auto w-[min(92vw,calc((100dvh-7rem)*16/9),80rem)] max-w-none overflow-visible bg-transparent p-0 text-fg',
          // Backdrop: transparent at rest, in over 500ms, out over 240ms.
          'backdrop:bg-black/0 backdrop:backdrop-blur-[0px] backdrop:transition-[background-color,backdrop-filter] backdrop:duration-500 backdrop:ease-out',
          'data-[phase=open]:backdrop:bg-black/85 data-[phase=open]:backdrop:backdrop-blur-md',
          'data-[phase=leaving]:backdrop:duration-[240ms] data-[phase=leaving]:backdrop:ease-in',
          'motion-reduce:backdrop:duration-150',
        )}
      >
        {isShown ? (
          <div
            className={cn(
              'relative origin-center',
              'translate-y-3 scale-[0.96] opacity-0 transition-[opacity,translate,scale] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,translate,scale]',
              'group-data-[phase=open]/modal:translate-y-0 group-data-[phase=open]/modal:scale-100 group-data-[phase=open]/modal:opacity-100',
              'group-data-[phase=leaving]/modal:translate-y-1.5 group-data-[phase=leaving]/modal:scale-[0.98] group-data-[phase=leaving]/modal:duration-[240ms] group-data-[phase=leaving]/modal:ease-[cubic-bezier(0.4,0,1,1)]',
              'motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:duration-150 motion-reduce:group-data-[phase=leaving]/modal:duration-[120ms]',
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="label-mono">Payload Stack · launch film</p>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="grid size-9 place-items-center border border-border-strong text-fg transition-colors duration-150 hover:border-fg hover:bg-fg hover:text-bg focus-visible:border-fg"
              >
                <CloseGlyph />
              </button>
            </div>
            <Clip id="stack-launch-film" playOnMount />
          </div>
        ) : null}
      </dialog>
    </>
  )
}

/** Ramp the volume to zero over the leave transition, so closing doesn't cut the sound. */
function fadeOutSound(video: HTMLVideoElement | null, duration: number) {
  if (!video || video.paused || video.muted) return
  const from = video.volume
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1)
    video.volume = from * (1 - progress)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function CloseGlyph() {
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
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  )
}
