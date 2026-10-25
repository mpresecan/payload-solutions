import type { ReactNode } from 'react'
import { MailtoLink } from './mailto-link'

/**
 * An email address that survives Cloudflare's Email Address Obfuscation.
 *
 * Cloudflare rewrites every address it finds in the HTML into
 * `<a class="__cf_email__">[email protected]</a>` and decodes it again with a script. Anything
 * React hydrates then no longer matches the server render: React throws #418, discards the
 * server HTML and renders the whole page again on the client, which replays every entrance
 * animation (the hero "loading twice").
 *
 * Splitting the address across elements (`user<span>@</span>domain`) keeps it out of reach of
 * both Cloudflare's scanner and simple scrapers, so obfuscation can stay on site-wide. The parts
 * are split on the server, so a server-rendered address never appears whole in the RSC payload
 * either. With `link`, the `mailto:` href is assembled in the browser after hydration.
 */
export function Email({
  address,
  link = false,
  className,
}: {
  address: string
  /** Render a `mailto:` link instead of plain text. */
  link?: boolean
  className?: string
}) {
  const at = address.indexOf('@')
  const user = address.slice(0, at)
  const domain = address.slice(at + 1)
  const parts: ReactNode = (
    <>
      {user}
      <span>@</span>
      {domain}
    </>
  )

  if (!link) return <span className={className}>{parts}</span>
  return (
    <MailtoLink user={user} domain={domain} className={className}>
      {parts}
    </MailtoLink>
  )
}
