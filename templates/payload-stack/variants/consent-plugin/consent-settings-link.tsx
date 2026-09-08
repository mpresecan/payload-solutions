'use client'

import { ManageConsentButton } from '@payload-solutions/consent-react'

/**
 * Footer entry that reopens the preferences dialog. GDPR Art. 7(3): withdrawing consent has to be
 * as easy as giving it, which in practice means a link that is always there.
 *
 * It renders its own `<li>` so the footer list has no empty row in a project scaffolded without
 * Payload Consent.
 */
export function ConsentSettingsLink() {
  return (
    <li>
      <ManageConsentButton className="cursor-pointer hover:text-foreground" />
    </li>
  )
}
