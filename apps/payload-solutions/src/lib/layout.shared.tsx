import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { Logo, brands } from '@payload-solutions/brand'

/**
 * Shared Fumadocs layout options: brand logo in the docs nav, links back to the site.
 *
 * No `githubUrl` and no theme switch. Both fed Fumadocs' bar at the foot of the sidebar — a
 * repo-wide GitHub icon that ignored which product you were reading, and a second theme
 * control. `DocsSourceLink` takes that slot with a link to the source of the selected product,
 * and the theme control stays where the design puts it: the site footer, one per page.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo brand="solutions" size={22} />,
      url: '/',
    },
    themeSwitch: { enabled: false },
    links: [
      { text: 'Payload Stack', url: brands.stack.url, external: true },
      { text: 'Roadmap', url: '/#roadmap' },
      { text: 'Hire us', url: '/#contact' },
    ],
  }
}
