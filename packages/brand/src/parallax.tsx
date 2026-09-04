'use client'

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useReducedMotionSafe } from './reduced-motion'
import { useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * Scroll-linked depth. A child moves against the page at a fraction of the scroll speed
 * while its section is in view, so layered elements separate as you scroll past them.
 *
 * `speed` is the fraction of the section's travel the child moves: positive lags behind
 * the page (reads as further away), negative runs ahead (closer). Values between -0.3 and
 * 0.3 stay tasteful; the motion is transform only and collapses to static under reduced
 * motion. Uses Motion's scroll motion values, never a scroll listener.
 */
export interface ParallaxProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  speed?: number
  /** Extra travel in px applied on top of the fraction, for small elements. */
  distance?: number
  as?: 'div' | 'figure' | 'span'
}

export function Parallax({
  children,
  className,
  style,
  speed = 0.15,
  distance = 0,
  as = 'div',
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionSafe()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const range = speed * 240 + distance
  const y = useTransform(scrollYProgress, [0, 1], [range, -range])
  const Tag = motion[as]

  return (
    <Tag ref={ref} className={className} style={reduce ? style : { ...style, y }}>
      {children}
    </Tag>
  )
}

/**
 * Progress of a target element through the viewport, 0 when its top enters at the bottom,
 * 1 when its bottom leaves at the top. For building custom scroll-linked transforms.
 */
export function useSectionProgress(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return scrollYProgress
}
