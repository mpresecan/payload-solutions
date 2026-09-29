'use client'

import { useConsent } from '@payload-solutions/consent-react'
import { Cookie } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { ConsentPreferencesDialog } from './consent-preferences-dialog'

/** Where the card sits. `bottom` is a centred card, not a full-width bar. */
const POSITION: Record<string, string> = {
  bottom: 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
}

/**
 * Consent banner on top of `@payload-solutions/consent-react`, drawn with the site's own tokens
 * (adapted from the plugin's shadcn registry component).
 *
 * A card, not a bar: it never covers the page and never blocks it, because a cookie wall is not
 * valid consent. Accept and reject are the same size and both solid, so neither is nudged
 * (EDPB Guidelines 05/2020); customise sits below them where it does not compete. All copy comes
 * from `consentConfig` in src/lib/consent.ts.
 */
export function ConsentBanner() {
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
          'fixed z-50 w-[calc(100vw-2rem)] border border-border-strong bg-surface text-fg shadow-2xl sm:w-full sm:max-w-md',
          POSITION[banner.position] ?? POSITION.bottom,
        )}
        data-consent-banner=""
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <h2 className="text-base font-medium">{banner.title}</h2>
          <Cookie aria-hidden size={18} className="shrink-0 text-fg-subtle" />
        </header>

        <div className="space-y-2 px-4 py-3 text-sm">
          {reason ? <p className="font-medium">{reason}</p> : null}
          <p className="text-fg-muted">{banner.description}</p>
          {banner.links.cookies || banner.links.privacy ? (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
              {banner.links.cookies ? (
                <a className="text-fg-muted underline underline-offset-4 hover:text-fg" href={banner.links.cookies}>
                  Cookie policy
                </a>
              ) : null}
              {banner.links.privacy ? (
                <a className="text-fg-muted underline underline-offset-4 hover:text-fg" href={banner.links.privacy}>
                  Privacy policy
                </a>
              ) : null}
            </p>
          ) : null}
        </div>

        <footer className="grid gap-2 border-t border-border p-4">
          <div className={cn('grid gap-2', showReject ? 'grid-cols-2' : 'grid-cols-1')}>
            {showReject ? (
              <Button className="w-full" onClick={rejectAll}>
                {banner.labels.rejectAll}
              </Button>
            ) : null}
            <Button className="w-full" onClick={acceptAll}>
              {banner.labels.acceptAll}
            </Button>
          </div>
          <div className={cn('grid gap-2', optIn ? 'grid-cols-1' : 'grid-cols-2')}>
            <Button className="h-9 w-full text-sm" onClick={() => open('preferences')} variant="ghost">
              {banner.labels.customize}
            </Button>
            {!optIn ? (
              <Button className="h-9 w-full text-sm" onClick={dismiss} variant="ghost">
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
      return 'It has been a while. Please confirm your choices.'
    case 'documents':
      return 'Our privacy documents have been updated.'
    case 'categories':
    case 'trackers':
      return 'We have changed the services we use.'
    default:
      return null
  }
}
