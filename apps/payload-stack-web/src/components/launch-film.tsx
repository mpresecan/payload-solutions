'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Clip, PlayGlyph } from '@payload-solutions/brand/clip'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { cn } from '@/lib/cn'

/**
 * The hero's "Watch the launch film" button and the modal it opens.
 *
 * Nothing is downloaded until the click (the layout only preconnects to the CDN). The modal is
 * a native <dialog> opened with showModal(), so the top layer, the focus trap, Escape and
 * returning focus to the button come from the browser. The player mounts with the dialog and
 * unmounts with it, which is what stops the sound; it starts at once and with sound, because
 * the click that opened it is the gesture browsers ask for (it falls back to muted with a
 * "Sound on" button when one refuses).
 */
export function LaunchFilm({ className }: { className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const reduceMotion = useReducedMotionSafe()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return
    if (!dialog.open) dialog.showModal()
    // The page behind stays put while the film plays.
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [isOpen])

  const close = () => dialogRef.current?.close()

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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
        aria-label="Payload Stack launch film"
        onClose={() => setIsOpen(false)}
        // A click on the dialog box itself (not on its content) is a click on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="m-auto w-[min(92vw,calc((100dvh-7rem)*16/9),80rem)] max-w-none overflow-visible bg-transparent p-0 text-fg backdrop:bg-black/85 backdrop:backdrop-blur-sm"
      >
        {isOpen ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="label-mono">Payload Stack · launch film</p>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid size-9 place-items-center border border-border-strong text-fg transition-colors duration-150 hover:border-fg hover:bg-fg hover:text-bg focus-visible:border-fg"
              >
                <CloseGlyph />
              </button>
            </div>
            <Clip id="stack-launch-film" playOnMount />
          </motion.div>
        ) : null}
      </dialog>
    </>
  )
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
