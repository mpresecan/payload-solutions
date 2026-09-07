'use client'

import { useConsent } from '@payload-solutions/consent-react'
import { Cookie } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ConsentPreferencesDialog } from './consent-preferences-dialog.js'

/** Where the card sits. `bottom` is a centred card, not a full-width bar. */
const POSITION: Record<string, string> = {
  bottom: 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
}

/**
 * Consent banner + preferences dialog on top of `@payload-solutions/consent-react`.
 *
 * A card, not a bar: it never covers the page and never blocks it, because a cookie wall is not
 * valid consent. Accept and reject are the same size and both solid, so neither is nudged
 * (EDPB Guidelines 05/2020); customise sits below them where it does not compete.
 * All copy comes from the Payload admin through the config.
 */
export function ConsentBanner({ className }: { className?: string }) {
  const { ready, state, config, acceptAll, rejectAll, open, dismiss } = useConsent()
  if (!ready || !state || !config) return null

  const { banner } = config
  const optIn = state.model === 'opt-in'
  const showReject = optIn || banner.showRejectAll
  const reason = reasonText(state.repromptReason)

  if (state.ui !== 'banner') return <ConsentPreferencesDialog />

  return (
    <>
      <section
        aria-label={banner.title}
        className={cn(
          'fixed z-50 w-[calc(100vw-2rem)] sm:w-full sm:max-w-md',
          'rounded-lg border bg-background text-foreground shadow-lg dark:bg-card',
          'duration-300 animate-in fade-in slide-in-from-bottom-4',
          POSITION[banner.position] ?? POSITION.bottom,
          className,
        )}
        data-consent-banner=""
        role="region"
      >
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4">
          <h2 className="text-base font-medium sm:text-lg">{banner.title}</h2>
          <Cookie aria-hidden className="size-4 shrink-0 text-muted-foreground sm:size-5" />
        </header>

        <div className="space-y-2 px-4 py-3">
          {reason ? <p className="text-xs font-medium sm:text-sm">{reason}</p> : null}
          <p className="text-xs text-muted-foreground sm:text-sm">{banner.description}</p>
          {banner.links.cookies || banner.links.privacy ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {banner.links.cookies ? (
                <a className="underline underline-offset-4 hover:text-foreground" href={banner.links.cookies}>
                  Cookie policy
                </a>
              ) : null}
              {banner.links.privacy ? (
                <a className="underline underline-offset-4 hover:text-foreground" href={banner.links.privacy}>
                  Privacy policy
                </a>
              ) : null}
            </p>
          ) : null}
        </div>

        <footer className="grid gap-2 border-t p-4 dark:bg-background/20">
          <div className={cn('grid items-center gap-2', showReject ? 'grid-cols-2' : 'grid-cols-1')}>
            {showReject ? (
              <Button className="w-full" onClick={rejectAll} variant="secondary">
                {banner.labels.rejectAll}
              </Button>
            ) : null}
            <Button className="w-full" onClick={acceptAll}>
              {banner.labels.acceptAll}
            </Button>
          </div>
          <div className={cn('grid items-center gap-2', optIn ? 'grid-cols-1' : 'grid-cols-2')}>
            <Button className="w-full" onClick={() => open('preferences')} size="sm" variant="ghost">
              {banner.labels.customize}
            </Button>
            {!optIn ? (
              <Button className="w-full" onClick={dismiss} size="sm" variant="ghost">
                {banner.labels.close}
              </Button>
            ) : null}
          </div>
        </footer>
      </section>
      <ConsentPreferencesDialog />
    </>
  )
}

/** Says *why* the banner came back, which is the difference between an annoyance and an explanation. */
function reasonText(reason: NonNullable<ReturnType<typeof useConsent>['state']>['repromptReason']): string | null {
  switch (reason) {
    case 'expired':
      return 'It has been a while — please confirm your choices.'
    case 'documents':
      return 'Our privacy documents have been updated.'
    case 'categories':
    case 'trackers':
      return 'We have changed the services we use.'
    default:
      return null
  }
}
