'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger index for siblings revealed together. */
  index?: number
  as?: 'div' | 'li' | 'section'
}

/**
 * Enter-on-scroll for section content. Motivation: hierarchy, it draws the eye to each
 * section's headline as it arrives. Collapses to static under reduced motion.
 */
export function Reveal({ children, className, index = 0, as = 'div' }: RevealProps) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Tag>
  )
}
