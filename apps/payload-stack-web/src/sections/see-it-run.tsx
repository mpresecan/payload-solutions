'use client'

import { useEffect, useRef, useState } from 'react'
import { SectionHead } from '@payload-solutions/brand/lattice'
import { Clip } from '@payload-solutions/brand/clip'
import type { ClipId } from '@payload-solutions/brand/clips'
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

export function SeeItRun() {
  const [active, setActive] = useState<ClipId>('first-run')
  const playerRef = useRef<HTMLDivElement>(null)

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
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="demo-heading"
    >
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
            index={1}
            className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:order-2 lg:col-span-2 lg:self-start lg:pl-8"
          >
            <div ref={playerRef} className="scroll-mt-header">
              <Clip id={active} />
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
                  <button
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
                      {isActive ? (
                        <span className="mt-2 block max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                          {demo.body}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
