'use client'

import { useAuth } from '@payloadcms/ui'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { motion } from 'motion/react'
import posthog from 'posthog-js'
import { useEffect, useRef, type ReactNode } from 'react'

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

type AdminUser = {
  email: string
  id: number
  name?: string | null
}

export function PostHogIdentify({ children }: { children?: ReactNode }) {
  const { user } = useAuth<AdminUser>()
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return

    if (!user) {
      if (identifiedUserId.current) {
        posthog.reset()
        identifiedUserId.current = null
      }
      return
    }

    const userId = String(user.id)

    if (identifiedUserId.current === userId) return

    if (identifiedUserId.current) posthog.reset()

    posthog.identify(userId, {
      email: user.email,
      name: user.name ?? undefined,
    })
    identifiedUserId.current = userId
  }, [user])

  return children
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
