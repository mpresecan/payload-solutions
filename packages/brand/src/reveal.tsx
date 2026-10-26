'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { useReducedMotionSafe } from './reduced-motion'

/*
  The enter-on-scroll motion, taken from payloadcms.com (their Steps block, read off the
  source of payloadcms/website): content rises 3rem and media 6rem while fading in, over 1s on
  cubic-bezier(0.4, 0, 0, 1), siblings 75ms apart, once, when the element is well inside the
  viewport rather than the moment its top edge appears. Opacity and transform only: an earlier
  blur was dropped because animating filters was too heavy on phones.

  The CSS twin for content that must not wait for hydration (the heroes) is `.reveal-load` in
  css/tailwind.css; keep the two curves and the stagger in step.
*/
export const REVEAL_EASE = [0.4, 0, 0, 1] as const
export const REVEAL_DURATION_S = 1
export const REVEAL_STAGGER_S = 0.075

const VARIANTS = {
  /** Headlines, copy, lists. */
  content: { y: '3rem' },
  /** Screenshots, illustrations, code panels: they travel twice as far, as on payloadcms.com. */
  media: { y: '6rem' },
} as const

export type RevealVariant = keyof typeof VARIANTS

export interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger index for siblings revealed together. */
  index?: number
  as?: 'div' | 'li' | 'section' | 'figure'
  /** `media` for imagery and large panels; `content` (default) for everything you read. */
  variant?: RevealVariant
  id?: string
  /**
   * Which accent family the revealed content belongs to. Product and plugin cells set it so
   * the cell carries its own hue; see accentForSlug and tokens.css.
   */
  'data-brand'?: string
}

/**
 * Enter-on-scroll for section content. Motivation: hierarchy, it draws the eye to each
 * section's headline as it arrives. Collapses to static under reduced motion.
 */
export function Reveal({
  children,
  className,
  index = 0,
  as = 'div',
  variant = 'content',
  ...rest
}: RevealProps) {
  const reduce = useReducedMotionSafe()
  const Tag = motion[as]
  const from = VARIANTS[variant]
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: from.y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
      transition={{
        duration: REVEAL_DURATION_S,
        delay: index * REVEAL_STAGGER_S,
        ease: REVEAL_EASE,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
