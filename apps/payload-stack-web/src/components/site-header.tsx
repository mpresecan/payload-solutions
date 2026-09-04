import Link from 'next/link'
import { siGithub } from 'simple-icons'
import { Logo, brands } from '@payload-solutions/brand'
import { HeaderThemeSync } from '@payload-solutions/brand/use-header-theme'
import { BrandIcon } from '@/components/brand-icon'
import { MobileNav } from '@/components/mobile-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const brand = brands.stack

const NAV = [
  { href: '#inside', label: 'Inside' },
  { href: '#how', label: 'How it works' },
  { href: '#config', label: 'Config' },
  { href: '#why', label: 'Why Payload' },
]

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 h-header hairline-b">
      <HeaderThemeSync />
      <div className="container-content flex h-full items-center justify-between gap-6">
        <Link href="/" className="flex items-center text-fg" aria-label="Payload Stack home">
          <Logo brand="stack" size={24} />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm text-fg-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-fg">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={brand.github}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHub repository"
            className="inline-flex h-9 w-9 items-center justify-center text-fg-muted transition-colors hover:text-fg"
          >
            <BrandIcon icon={siGithub} size={18} />
          </a>
          <ThemeToggle />
          <div className="ml-1 hidden sm:block">
            <Button href={brand.docsUrl} variant="secondary" className="h-9 px-3 text-sm" arrow>
              Documentation
            </Button>
          </div>
          <MobileNav
            items={[...NAV, { href: brand.docsUrl, label: 'Documentation', external: true }]}
          />
        </div>
      </div>
    </header>
  )
}
