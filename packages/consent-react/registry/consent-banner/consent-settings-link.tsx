'use client'

import { ManageConsentButton } from '@payload-solutions/consent-react'

import { cn } from '@/lib/utils'

/** Footer link that reopens the preferences dialog (GDPR Art. 7(3): withdrawing must be as easy as consenting). */
export function ConsentSettingsLink({ className }: { className?: string }) {
  return <ManageConsentButton className={cn('text-sm text-muted-foreground underline-offset-4 hover:underline', className)} />
}
