import {
  siBetterauth,
  siMongodb,
  siNextdotjs,
  siPayloadcms,
  siPostgresql,
  siResend,
  siShadcnui,
  siSqlite,
  siStripe,
  siTailwindcss,
  siTurborepo,
  siVercel,
} from 'simple-icons'
import { BrandIcon } from '@/components/brand-icon'

const LOGOS = [
  { icon: siPayloadcms, href: 'https://payloadcms.com' },
  { icon: siNextdotjs, href: 'https://nextjs.org' },
  { icon: siBetterauth, href: 'https://better-auth.com' },
  { icon: siStripe, href: 'https://stripe.com' },
  { icon: siShadcnui, href: 'https://ui.shadcn.com' },
  { icon: siTailwindcss, href: 'https://tailwindcss.com' },
  { icon: siPostgresql, href: 'https://www.postgresql.org' },
  { icon: siMongodb, href: 'https://www.mongodb.com' },
  { icon: siSqlite, href: 'https://sqlite.org' },
  { icon: siResend, href: 'https://resend.com' },
  { icon: siVercel, href: 'https://vercel.com' },
  { icon: siTurborepo, href: 'https://turbo.build' },
]

/** Logo wall, logos only. Sits directly under the hero as its own section. */
export function BuiltWith() {
  return (
    <section aria-label="Built with" className="hairline-t hairline-b relative">
      <div className="container-content flex flex-col gap-7 py-9 md:flex-row md:items-center md:gap-12">
        <p className="label-mono shrink-0">Built with</p>
        <ul className="grid grid-cols-4 gap-x-6 gap-y-6 sm:grid-cols-6 md:flex md:flex-1 md:flex-wrap md:items-center md:justify-between">
          {LOGOS.map(({ icon, href }) => (
            <li
              key={icon.slug}
              className="flex items-center justify-center text-fg-subtle transition-colors hover:text-fg"
            >
              <a href={href} target="_blank" rel="noreferrer noopener" aria-label={icon.title}>
                <BrandIcon icon={icon} size={26} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
