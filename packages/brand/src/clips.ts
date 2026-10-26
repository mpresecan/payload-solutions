/**
 * The X campaign videos (github.com/mpresecan/payload-solutions-campaigm), served from the
 * R2 bucket behind cdn.payload.solutions. Every clip is a real recording of a real app,
 * rendered at 1920x1080, H.264, no audio.
 *
 * The renders are the X cuts: each opens on a hook card (the post's opening line, e.g.
 * "Mistake 2 of 5") and ends on a URL card, both noise on our own pages. `start` and `end`
 * trim them at playback, without a re-render: `start` is the composition's HOOK sequence and
 * `end` its TOTAL minus its OUTRO (or URLS) sequence, in seconds at 30 fps.
 *
 * The films at the top of `clips` are the exception: produced pieces with a soundtrack, played
 * whole and with sound (`hasAudio`).
 *
 * Posters are frames pulled from the same renders (assets/clips, 1280w webp). Re-pull them
 * when a video is re-rendered: `ffmpeg -ss <t> -i <file>.mp4 -frames:v 1 -vf scale=1280:-1
 * -c:v libwebp -quality 72 assets/clips/<id>.webp`.
 */
import type { StaticImageData } from 'next/image'

import accessAsCode from '../assets/clips/access-as-code.webp'
import actionScheduler from '../assets/clips/action-scheduler.webp'
import apiKeys from '../assets/clips/api-keys.webp'
import b2cB2b from '../assets/clips/b2c-b2b.webp'
import backOffice from '../assets/clips/back-office.webp'
import consent from '../assets/clips/consent.webp'
import emailBranding from '../assets/clips/email-branding.webp'
import emails from '../assets/clips/emails.webp'
import firstRun from '../assets/clips/first-run.webp'
import fourPlugins from '../assets/clips/four-plugins.webp'
import generatedTypes from '../assets/clips/generated-types.webp'
import impersonation from '../assets/clips/impersonation.webp'
import insideNextjs from '../assets/clips/inside-nextjs.webp'
import legalPages from '../assets/clips/legal-pages.webp'
import multiTenancy from '../assets/clips/multi-tenancy.webp'
import neverBuildAgain from '../assets/clips/never-build-again.webp'
import onboarding from '../assets/clips/onboarding.webp'
import oneApp from '../assets/clips/one-app.webp'
import oneConfig from '../assets/clips/one-config.webp'
import oneSession from '../assets/clips/one-session.webp'
import overkill from '../assets/clips/overkill.webp'
import pinned from '../assets/clips/pinned.webp'
import playwrightJourneys from '../assets/clips/playwright-journeys.webp'
import postgresOrMongo from '../assets/clips/postgres-or-mongo.webp'
import roadmap from '../assets/clips/roadmap.webp'
import schedulerCron from '../assets/clips/scheduler-cron.webp'
import twoInterfaces from '../assets/clips/two-interfaces.webp'
import useTheAdmin from '../assets/clips/use-the-admin.webp'
import vercelDeploys from '../assets/clips/vercel-deploys.webp'
import vercelLoop from '../assets/clips/vercel-loop.webp'
import wordpress from '../assets/clips/wordpress.webp'

export const CLIP_CDN = 'https://cdn.payload.solutions'

export type ClipEntry = {
  /** Object key in the bucket. */
  file: string
  /**
   * Still shown before playback. Without one the player preloads the file's metadata and
   * shows its first frame instead (desktop browsers; iOS shows the frame's background).
   */
  poster?: StaticImageData
  /** What the clip shows, for screen readers and as the player's label. */
  alt: string
  /** Seconds. Playback starts here, after the X hook card (the post's opening line). Default 0. */
  start?: number
  /** Seconds. Playback loops back to `start` here, before the X outro card. Default: the end. */
  end?: number
  /**
   * A film with a soundtrack rather than a silent screen recording: never autoplays, plays
   * with sound on the visitor's click, has a mute button, and stops at the end instead of
   * looping.
   */
  hasAudio?: boolean
  /** The campaign post it was made for, to find its source in the campaign repo. */
  post?: number
}

export const clips = {
  // Films: produced pieces with sound, not campaign screen recordings.
  'stack-launch-film': {
    file: 'payload-stack-launch-film.mp4',
    alt: 'The Payload Stack launch film',
    hasAudio: true,
  },
  'stack-launch-film-v2': {
    file: 'payload-stack-launch-film-v2.mp4',
    alt: 'Payload Stack: the introduction film',
    hasAudio: true,
  },
  'emails-promo': {
    file: 'payload-emails-promo.mp4',
    alt: 'Transactional Emails: the introduction film',
    hasAudio: true,
  },

  // Campaign screen recordings: silent, trimmed, looping.
  'first-run': {
    file: 'payload-stack-post-89-first-run.mp4',
    start: 3.5,
    poster: firstRun,
    alt: 'npx create-payload-stack@latest run in a terminal, then the first admin created and the Payload admin opening',
    end: 50.4,
    post: 89,
  },
  pinned: {
    file: 'payload-solutions-post-100-pinned.mp4',
    start: 2.5,
    poster: pinned,
    alt: 'From an empty folder to a running Payload Stack admin, cut down',
    end: 24,
    post: 100,
  },
  'never-build-again': {
    file: 'payload-stack-post-29-never-build-again.mp4',
    start: 4,
    poster: neverBuildAgain,
    alt: 'Ten things a Payload Stack project never builds again, from the pricing page to the sitemap',
    end: 37.9,
    post: 29,
  },
  'postgres-or-mongo': {
    file: 'payload-stack-post-32-postgres-or-mongo.mp4',
    start: 4,
    poster: postgresOrMongo,
    alt: 'The CLI database prompt and the one db line it writes, then the same projects screen on PostgreSQL and on SQLite',
    end: 36.5,
    post: 32,
  },
  'access-as-code': {
    file: 'payload-stack-post-33-access-as-code.mp4',
    start: 4,
    poster: accessAsCode,
    alt: 'Access rules in code, then the same /api/projects URL as an anonymous visitor, a member and the site admin',
    end: 35.3,
    post: 33,
  },
  'back-office': {
    file: 'payload-stack-post-37-back-office.mp4',
    start: 4,
    poster: backOffice,
    alt: 'Versions, consent records, the media library, the tenant switcher and impersonation in the Payload admin',
    end: 31.1,
    post: 37,
  },
  'generated-types': {
    file: 'payload-stack-post-42-generated-types.mp4',
    start: 4,
    poster: generatedTypes,
    alt: 'A collection, the TypeScript interface Payload generates from it, and the type error a misspelled field produces',
    end: 30.5,
    post: 42,
  },
  'one-session': {
    file: 'payload-stack-post-44-one-session.mp4',
    start: 4,
    poster: oneSession,
    alt: 'One Better Auth session signing a user into both the app dashboard and the Payload admin',
    end: 37,
    post: 44,
  },
  'multi-tenancy': {
    file: 'payload-stack-post-45-multi-tenancy.mp4',
    start: 4,
    poster: multiTenancy,
    alt: 'Switching organizations in the dashboard and filtering by tenant in the Payload admin',
    end: 35.9,
    post: 45,
  },
  'scheduler-cron': {
    file: 'payload-stack-post-47-scheduler-cron.mp4',
    start: 4,
    poster: schedulerCron,
    alt: 'Scheduled actions waiting until something calls the job queue, then running on that call',
    end: 44.7,
    post: 47,
  },
  'use-the-admin': {
    file: 'payload-stack-post-48-use-the-admin.mp4',
    start: 4,
    poster: useTheAdmin,
    alt: 'Users, organizations and members managed in the Payload admin instead of a hand-built back office',
    end: 35.3,
    post: 48,
  },
  'four-plugins': {
    file: 'payload-solutions-post-51-four-plugins.mp4',
    start: 4,
    poster: fourPlugins,
    alt: 'Cookie Consent, Transactional Emails, Action Scheduler and the Vercel Integration, one after another',
    end: 40,
    post: 51,
  },
  consent: {
    file: 'payload-consent-post-52.mp4',
    start: 4,
    poster: consent,
    alt: 'The cookie banner on a site, its trackers and categories in the Payload admin, and the legal pages it drives',
    end: 38.3,
    post: 52,
  },
  emails: {
    file: 'payload-emails-post-53.mp4',
    start: 4,
    poster: emails,
    alt: 'An editor changing a transactional email in the Payload admin and previewing the rendered email',
    end: 33.9,
    post: 53,
  },
  'vercel-deploys': {
    file: 'payload-vercel-post-54-deploys.mp4',
    start: 4,
    poster: vercelDeploys,
    alt: 'Triggering a Vercel deploy from the Payload admin and following its status there (Vercel API mocked for the demo)',
    end: 48.1,
    post: 54,
  },
  'action-scheduler': {
    file: 'payload-scheduler-post-55.mp4',
    start: 4,
    poster: actionScheduler,
    alt: 'Scheduling an action with arguments in the Payload admin and running the queue',
    end: 26.6,
    post: 55,
  },
  'one-config': {
    file: 'payload-solutions-post-56-one-config.mp4',
    start: 4,
    poster: oneConfig,
    alt: 'Four payload.solutions plugins added in one plugins array in payload.config.ts',
    end: 27.3,
    post: 56,
  },
  'vercel-loop': {
    file: 'payload-stack-post-59-vercel-loop.mp4',
    start: 4,
    poster: vercelLoop,
    alt: 'The CLI picking Vercel Postgres, Blob and cron, then deploying and running the queue on Vercel',
    end: 49.2,
    post: 59,
  },
  roadmap: {
    file: 'payload-solutions-post-63-roadmap.mp4',
    start: 4,
    poster: roadmap,
    alt: 'Adding a shipped item to the payload.solutions roadmap collection in the admin and seeing it on the site',
    end: 42.5,
    post: 63,
  },
  'two-interfaces': {
    file: 'payload-stack-post-67-two-interfaces.mp4',
    start: 4,
    poster: twoInterfaces,
    alt: 'A user adds a project in the shadcn dashboard, the team pauses it in the Payload admin, and the dashboard shows it paused',
    end: 35,
    post: 67,
  },
  'email-branding': {
    file: 'payload-emails-post-68-branding.mp4',
    start: 4,
    poster: emailBranding,
    alt: 'An editor changes an email body and the preview renders it inside the unchanged React Email template',
    end: 27.9,
    post: 68,
  },
  'b2c-b2b': {
    file: 'payload-stack-post-71-b2c-b2b.mp4',
    start: 4,
    poster: b2cB2b,
    alt: 'Switching stack.config.ts from organizations to per-user billing, and the dashboard following it',
    end: 28.8,
    post: 71,
  },
  'playwright-journeys': {
    file: 'payload-stack-post-73-playwright-journeys.mp4',
    start: 4,
    poster: playwrightJourneys,
    alt: 'The Playwright user journeys passing for a B2B and a B2C configuration',
    end: 48.8,
    post: 73,
  },
  wordpress: {
    file: 'payload-action-scheduler-post-86-wordpress.mp4',
    start: 4,
    poster: wordpress,
    alt: 'The Scheduled Actions screen in the Payload admin, modelled on WordPress Action Scheduler',
    end: 37.9,
    post: 86,
  },
  'inside-nextjs': {
    file: 'payload-stack-post-87-inside-nextjs.mp4',
    start: 4,
    poster: insideNextjs,
    alt: 'Payload inside the Next.js app folder, queried from a page through the local API with no HTTP hop',
    end: 41.2,
    post: 87,
  },
  overkill: {
    file: 'payload-stack-post-88-overkill.mp4',
    start: 4,
    poster: overkill,
    alt: 'Invites and roles, transactional emails and the admin a Payload Stack project ships with',
    end: 40.6,
    post: 88,
  },
  'one-app': {
    file: 'payload-stack-post-90-one-app.mp4',
    start: 4,
    poster: oneApp,
    alt: 'Auth, billing, admin, REST and GraphQL and the marketing site served by one Next.js app',
    end: 47.6,
    post: 90,
  },
  impersonation: {
    file: 'payload-stack-post-91-impersonation.mp4',
    start: 3.5,
    poster: impersonation,
    alt: 'A super-admin impersonating a customer from the user list and seeing her organization and data',
    end: 29.4,
    post: 91,
  },
  'api-keys': {
    file: 'payload-stack-post-92-api-keys.mp4',
    start: 4,
    poster: apiKeys,
    alt: 'A customer creates an API key on their settings page and calls the Payload REST API with it',
    end: 31.9,
    post: 92,
  },
  onboarding: {
    file: 'payload-stack-post-93-onboarding.mp4',
    start: 4,
    poster: onboarding,
    alt: 'Onboarding: naming the organization, inviting a teammate with a role, and the pending invitation',
    end: 41.3,
    post: 93,
  },
  'legal-pages': {
    file: 'payload-consent-post-95-legal-pages.mp4',
    start: 4,
    poster: legalPages,
    alt: 'A legal page edited in the Payload admin, published, and compared against an earlier version',
    end: 35.7,
    post: 95,
  },
} satisfies Record<string, ClipEntry>

export type ClipId = keyof typeof clips

export function clipUrl(id: ClipId): string {
  return `${CLIP_CDN}/${clips[id].file}`
}

/** One entry, typed as the wide `ClipEntry` so its optional fields can be read. */
export function clipEntry(id: ClipId): ClipEntry {
  return clips[id]
}
