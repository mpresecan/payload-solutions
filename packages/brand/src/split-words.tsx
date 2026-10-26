'use client'

import { type CSSProperties, useEffect, useRef } from 'react'

/*
  Headline word reveal, ported from payloadcms.com's `SplitAnimate` (payloadcms/website,
  src/components/SplitAnimate). Every word sits in its own clipping mask and rises into it
  from 150% below, tilted 10°, over 1.125s on cubic-bezier(0.165, 0.84, 0.44, 1), words 75ms
  apart, once.

  Theirs runs a framer-motion animation per word. This one is CSS transitions plus a single
  IntersectionObserver per headline that flips `data-in` on the element, so there is no React
  re-render and no per-frame JavaScript: the phone only composites a few transforms. No
  filters anywhere, on purpose (blur was too heavy on phones).

  Styles: `.split-words*` in css/tailwind.css. Under reduced motion the words are simply there.
*/

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

export interface SplitWordsProps {
  text: string
  as?: Tag
  id?: string
  className?: string
}

export function SplitWords({ text, as: Element = 'h2', id, className }: SplitWordsProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Same trigger as <Reveal>: once the headline is well inside the viewport, so the words
    // rise together with the block around them rather than off screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.setAttribute('data-in', '')
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const words = text.trim().split(/\s+/)

  return (
    <Element
      // The ref type differs per tag; all of them are HTMLElements.
      ref={ref as never}
      id={id}
      className={`split-words ${className ?? ''}`}
    >
      {words.map((word, i) => (
        <span key={i}>
          <span className="split-words__mask">
            <span className="split-words__word" style={{ '--i': i } as CSSProperties}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Element>
  )
}
