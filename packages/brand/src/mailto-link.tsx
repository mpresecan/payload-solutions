'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** The `mailto:` half of `Email`: the href is set only in the browser, never in the HTML. */
export function MailtoLink({
  user,
  domain,
  className,
  children,
}: {
  user: string
  domain: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.href = `mailto:${user}@${domain}`
  }, [user, domain])

  return (
    <a ref={ref} className={className}>
      {children}
    </a>
  )
}
