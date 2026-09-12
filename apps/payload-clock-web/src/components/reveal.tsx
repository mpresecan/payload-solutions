'use client'

import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger index for siblings revealed together. */
  index?: number
  as?: 'div' | 'li' | 'section'
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
export function Reveal({ children, className, index = 0, as = 'div', ...rest }: RevealProps) {
  const reduce = useReducedMotionSafe()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
