import type { VariableManifest } from '@payload-solutions/plugin-emails'

import { paths } from '@/lib/paths'
import stack from '@/stack.config'

/**
 * Variables every email can use, on top of whatever each definition resolves for itself.
 *
 * They come from `src/stack.config.ts` and `src/lib/paths.ts`, so renaming the product or moving a
 * route updates every email at once — including the copy editors have already changed in the admin,
 * because the copy stores `{{tokens}}`, not values.
 *
 * Email Settings (Payload admin) can override the site name, site URL and reply-to address per
 * environment; those win, and the config is the fallback.
 */

const url = (path: string) => `${stack.url.replace(/\/$/, '')}${path}`

export function globalVariables({ settings }: { settings: { replyTo?: string; siteName?: string; siteUrl?: string } }) {
  const base = (settings.siteUrl || stack.url).replace(/\/$/, '')
  const at = (path: string) => `${base}${path}`

  return {
    'site.name': settings.siteName || stack.name,
    'site.url': base,
    'site.tagline': stack.tagline,
    'support.email': settings.replyTo || stack.support.email,
    'company.name': stack.legal.company,
    'company.jurisdiction': stack.legal.jurisdiction,
    year: new Date().getFullYear(),

    // Links editors reach for constantly. Absolute, because an email has no origin.
    'url.home': at(paths.home),
    'url.signIn': at(paths.auth.signIn),
    'url.dashboard': at(paths.dashboard.home),
    'url.account': at(paths.dashboard.account),
    'url.security': at(paths.dashboard.security),
    'url.billing': at(stack.features.billing ? paths.dashboard.billing : paths.dashboard.settings),
    'url.pricing': at(paths.pricing),
    'url.privacy': at(paths.legal('privacy')),
    'url.terms': at(paths.legal('terms')),
  }
}

/** Chips and descriptions shown beside the editor, so nobody has to guess a token's name. */
export const globalVariableManifest: VariableManifest = {
  'site.name': { description: 'Product name (Email Settings, falling back to stack.config)', example: stack.name },
  'site.url': { description: 'Canonical site URL', example: stack.url, type: 'url' },
  'site.tagline': { description: 'One-line product description', example: stack.tagline },
  'support.email': { description: 'Where replies and questions should go', example: stack.support.email },
  'company.name': { description: 'Legal entity behind the product', example: stack.legal.company },
  'company.jurisdiction': { description: 'Where that entity is registered', example: stack.legal.jurisdiction },
  year: { description: 'Current year, for the footer', example: new Date().getFullYear(), type: 'number' },

  'url.home': { description: 'Marketing home page', example: url(paths.home), type: 'url' },
  'url.signIn': { description: 'Sign-in page', example: url(paths.auth.signIn), type: 'url' },
  'url.dashboard': { description: 'Signed-in dashboard', example: url(paths.dashboard.home), type: 'url' },
  'url.account': { description: 'Account settings', example: url(paths.dashboard.account), type: 'url' },
  'url.security': { description: 'Security settings (password, 2FA, sessions)', example: url(paths.dashboard.security), type: 'url' },
  'url.billing': { description: 'Billing settings', example: url(paths.dashboard.billing), type: 'url' },
  'url.pricing': { description: 'Pricing page', example: url(paths.pricing), type: 'url' },
  'url.privacy': { description: 'Privacy policy', example: url(paths.legal('privacy')), type: 'url' },
  'url.terms': { description: 'Terms of service', example: url(paths.legal('terms')), type: 'url' },
}
