import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { Logo, brands } from '@payload-solutions/brand'

/** Shared Fumadocs layout options: brand logo in the docs nav, links back to the site. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo brand="solutions" size={22} />,
      url: '/',
    },
    githubUrl: brands.solutions.github,
    links: [
      { text: 'Payload Stack', url: brands.stack.url, external: true },
      { text: 'Roadmap', url: '/#roadmap' },
      { text: 'Hire us', url: '/#contact' },
    ],
  }
}
