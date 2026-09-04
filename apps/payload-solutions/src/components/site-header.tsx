import Link from 'next/link'
import { siGithub } from 'simple-icons'
import { Logo, brands } from '@payload-solutions/brand'
import { HeaderThemeSync } from '@payload-solutions/brand/use-header-theme'

import { BrandIcon } from '@/components/brand-icon'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const brand = brands.solutions

const NAV = [
  { href: '/#products', label: 'Products' },
  { href: '/#plugins', label: 'Plugins' },
  { href: '/#roadmap', label: 'Roadmap' },
  { href: '/docs', label: 'Docs' },
]

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 h-header hairline-b">
      <HeaderThemeSync />
      <div className="container-content flex h-full items-center justify-between gap-6">
        <Link href="/" className="flex items-center text-fg" aria-label="Payload Solutions home">
          <Logo brand="solutions" size={24} />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm text-fg-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-fg">
                  {item.label}
                </Link>
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
            <Button href="/#contact" className="h-9 px-3 text-sm">
              Start a project
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
