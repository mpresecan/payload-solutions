import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A snippet, in the lattice: hairline top rule, mono type, a filename in the corner. No
 * rounded panel, no filled background — the `code-block` class and its four token colours
 * are shared with payloadstack.com through globals.css.
 */
export function CodeBlock({
  file,
  children,
  className,
}: {
  file?: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={cn('border-t border-border', className)}>
      {file ? (
        <figcaption className="label-mono flex items-center justify-between px-1 py-3.5">
          <span>{file}</span>
        </figcaption>
      ) : null}
      <pre className={cn('code-block px-1 pb-6', file ? 'pt-0' : 'pt-6')}>
        <code>{children}</code>
      </pre>
    </figure>
  )
}

/** Token spans, matching the four `code-block .tok-*` rules. */
export const k = (s: string) => <span className="tok-k">{s}</span>
export const str = (s: string) => <span className="tok-s">{s}</span>
export const c = (s: string) => <span className="tok-c">{s}</span>
export const p = (s: string) => <span className="tok-p">{s}</span>
