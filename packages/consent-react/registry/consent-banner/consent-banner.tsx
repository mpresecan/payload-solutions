'use client'

import { useConsent } from '@payload-solutions/consent-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ConsentPreferencesDialog } from './consent-preferences-dialog.js'

const POSITION: Record<string, string> = {
  bottom: 'inset-x-0 bottom-0',
  'bottom-left': 'bottom-4 left-4 max-w-md',
  'bottom-right': 'bottom-4 right-4 max-w-md',
  center: 'inset-x-0 bottom-4 mx-auto max-w-lg',
}

/**
 * Consent banner + preferences dialog on top of `@payload-solutions/consent-react`.
 * Non-modal: it never blocks the page (cookie walls are not valid consent). Accept and reject share
 * one variant so neither is nudged. Copy comes from the Payload admin via the config.
 */
export function ConsentBanner({ className }: { className?: string }) {
  const { ready, state, config, acceptAll, rejectAll, open, dismiss } = useConsent()
  if (!ready || !state || !config) return null

  const { banner } = config
  const optIn = state.model === 'opt-in'
  const showBanner = state.ui === 'banner'
  const reason = state.repromptReason

  return (
    <>
      {showBanner ? (
        <section
          role="region"
          aria-label={banner.title}
          data-consent-banner=""
          className={cn(
            'fixed z-50 border-t bg-background p-4 text-foreground shadow-lg sm:p-6',
            POSITION[banner.position] ?? POSITION.bottom,
            banner.position !== 'bottom' && 'rounded-lg border',
            className,
          )}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">{banner.title}</h2>
              <p className="text-sm text-muted-foreground">
                {reason ? <ReasonPrefix reason={reason} /> : null}
                {banner.description}{' '}
                {banner.links.cookies ? (
                  <a className="underline underline-offset-4" href={banner.links.cookies}>
                    Cookie policy
                  </a>
                ) : null}
                {banner.links.privacy ? (
                  <>
                    {banner.links.cookies ? ' · ' : ''}
                    <a className="underline underline-offset-4" href={banner.links.privacy}>
                      Privacy policy
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" onClick={() => open('preferences')}>
                {banner.labels.customize}
              </Button>
              {optIn || banner.showRejectAll ? (
                <Button variant="default" onClick={rejectAll}>
                  {banner.labels.rejectAll}
                </Button>
              ) : null}
              <Button variant="default" onClick={acceptAll}>
                {banner.labels.acceptAll}
              </Button>
              {!optIn ? (
                <Button variant="ghost" onClick={dismiss} aria-label={banner.labels.close}>
                  {banner.labels.close}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      <ConsentPreferencesDialog />
    </>
  )
}

function ReasonPrefix({ reason }: { reason: NonNullable<ReturnType<typeof useConsent>['state']>['repromptReason'] }) {
  const text =
    reason === 'expired'
      ? 'It has been a while since you chose, please confirm your preferences. '
      : reason === 'documents'
        ? 'Our policies have changed, please review your preferences. '
        : reason === 'categories' || reason === 'trackers'
          ? 'We changed the services we use, please review your preferences. '
          : ''
  return text ? <span>{text}</span> : null
}
