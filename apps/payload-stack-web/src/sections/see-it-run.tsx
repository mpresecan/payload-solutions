'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHead } from '@payload-solutions/brand/lattice'
import { Clip } from '@payload-solutions/brand/clip'
import type { ClipId } from '@payload-solutions/brand/clips'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/cn'

interface Demo {
  id: ClipId
  title: string
  body: string
}

/**
 * Real recordings of a scaffolded Payload Stack app, the same ones the X campaign posts.
 * Order follows a new user's path: create the project, sign in, set up the team, then what
 * the team gets behind it.
 */
const DEMOS: Demo[] = [
  {
    id: 'first-run',
    title: 'One command to a running admin',
    body: 'npx create-payload-stack@latest, the prompts, the first admin account. The install and the first compile are sped up and badged; everything else is real time.',
  },
  {
    id: 'one-session',
    title: 'One session for the app and the admin',
    body: 'A user signs in once with Better Auth and is signed in to the dashboard and the Payload admin. Sign out once, and both are gone.',
  },
  {
    id: 'onboarding',
    title: 'Onboarding and invitations',
    body: 'A new user names their organization, invites a teammate with a role, and the invitation email is already on its way.',
  },
  {
    id: 'multi-tenancy',
    title: 'Every record scoped to an organization',
    body: 'Switch organization in the app and only its data shows. In the admin, the tenant filter narrows to one in a click.',
  },
  {
    id: 'two-interfaces',
    title: 'Your dashboard, their admin, one row',
    body: 'A customer adds a project in the shadcn dashboard. The team pauses it in the Payload admin. The customer sees it paused.',
  },
  {
    id: 'impersonation',
    title: 'Support can act as the customer',
    body: 'A super-admin impersonates a user from the admin and sees exactly her organization and her data.',
  },
  {
    id: 'api-keys',
    title: 'API keys for your customers',
    body: 'Every customer gets an API keys page. The key is shown once, stored hashed, and authenticates Payload’s REST API as them.',
  },
  {
    id: 'access-as-code',
    title: 'Access control as code',
    body: 'Rules live next to the collections. The same URL answers differently for a visitor, a member and the site admin.',
  },
  {
    id: 'generated-types',
    title: 'Types from your collections',
    body: 'Payload writes the TypeScript interface for every collection. Misspell a field and the build stops, not production.',
  },
]

const HASH_PREFIX = '#demo-'

/** The slide-btn curve from packages/brand, so the player moves like the buttons around it. */
const EASE_OUT: [number, number, number, number] = [0.165, 0.84, 0.44, 1]
const EASE_IN: [number, number, number, number] = [0.55, 0, 0.75, 0.2]

/**
 * One upward push per tab click. The leaving clip is quicker than the arriving one, the same
 * out-of-step timing the slide buttons use, so the two never read as one block moving.
 */
const SWAP = {
  enter: { opacity: 0, y: '38%', scale: 1.04, zIndex: 1 },
  rest: { opacity: 1, y: '0%', scale: 1, zIndex: 1 },
  leave: {
    opacity: 0,
    y: '-30%',
    scale: 0.96,
    zIndex: 0,
    pointerEvents: 'none' as const,
    transition: { duration: 0.5, ease: EASE_IN },
  },
  enterTransition: { duration: 0.85, ease: EASE_OUT, delay: 0.06 },
}

export function SeeItRun() {
  const [active, setActive] = useState<ClipId>('first-run')
  const playerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotionSafe()

  // Deep links: /#demo-multi-tenancy opens that tab. The campaign's first replies point here.
  useEffect(() => {
    const fromHash = () => {
      if (!window.location.hash.startsWith(HASH_PREFIX)) return
      const id = window.location.hash.slice(HASH_PREFIX.length)
      const match = DEMOS.find((demo) => demo.id === id)
      if (!match) return
      setActive(match.id)
      document.getElementById('demo')?.scrollIntoView()
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const select = (id: ClipId) => {
    setActive(id)
    window.history.replaceState(null, '', `${HASH_PREFIX}${id}`)
    // Below lg the player sits above the list, so a tab further down would change a video
    // that is off screen. Bring it back; from lg it is sticky beside the list.
    const player = playerRef.current
    if (player && !window.matchMedia('(min-width: 1024px)').matches) {
      const { top } = player.getBoundingClientRect()
      if (top < 0) player.scrollIntoView({ block: 'start' })
    }
  }

  return (
    <section
      id="demo"
      className="scroll-mt-header relative hairline-t py-section"
      aria-labelledby="demo-heading"
    >
      <GridCross line={4} />
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="demo-heading"
            eyebrow="See it run"
            title="Not screenshots. The app, recorded."
            lead="Each clip is a scaffolded Payload Stack project filmed in a real browser. Pick a feature."
          />
        </Reveal>

        <div className="col-grid mt-16 gap-y-10">
          {/* The player first on a phone, beside the list from lg, where it stays in view while
              the list scrolls. */}
          <Reveal
            variant="media"
            index={1}
            className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:order-2 lg:col-span-2 lg:self-start lg:pl-8"
          >
            <div ref={playerRef} className="scroll-mt-header">
              {/* The frame stays put and clips what passes through it: the outgoing clip lifts
                  up and fades out while the next one rises in from below, both at once, so a
                  tab click reads as the reel advancing rather than a flash between two videos. */}
              <div className="relative aspect-video overflow-hidden border border-border bg-surface">
                <AnimatePresence initial={false} mode="sync">
                  <motion.div
                    key={active}
                    className="absolute inset-0"
                    initial={reduceMotion ? false : SWAP.enter}
                    animate={SWAP.rest}
                    exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : SWAP.leave}
                    transition={reduceMotion ? { duration: 0 } : SWAP.enterTransition}
                  >
                    <Clip id={active} framed={false} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>

          <div className="min-w-0 lg:order-1 lg:col-span-2 lg:pr-8">
            <div
              role="tablist"
              aria-label="Features"
              aria-orientation="vertical"
              className="border-t border-border"
            >
              {DEMOS.map((demo, i) => {
                const isActive = demo.id === active
                return (
                  <motion.button
                    key={demo.id}
                    type="button"
                    role="tab"
                    id={`demo-tab-${demo.id}`}
                    aria-selected={isActive}
                    onClick={() => select(demo.id)}
                    className={cn(
                      'group flex w-full gap-5 border-b border-border py-5 text-left transition-colors duration-150',
                      isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
                    )}
                    layout
                    transition={{ layout: { duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] } }}
                  >
                    <span
                      className={cn(
                        'mt-1 font-mono text-[0.6875rem] tabular-nums transition-colors duration-150',
                        isActive ? 'text-accent' : 'text-fg-subtle',
                      )}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="display-sm block">{demo.title}</span>
                      <AnimatePresence initial={false}>
                        {isActive ? (
                          <motion.span
                            key="description"
                            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -5 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -3 }}
                            transition={{
                              duration: reduceMotion ? 0 : 0.24,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="mt-2 block max-w-[46ch] overflow-hidden text-pretty text-[0.9375rem] leading-relaxed text-fg-muted"
                          >
                            {demo.body}
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
