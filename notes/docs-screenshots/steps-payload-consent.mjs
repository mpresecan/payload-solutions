const card = (text) => (page) => page.getByText(text, { exact: true }).first().locator('xpath=ancestor::*[self::div or self::section or self::aside][.//button][1]')
export const steps = [
  { name: 'dashboard', path: '/admin', nav: true },
  { name: 'settings-general', path: '/admin/globals/consent-settings' },
  { name: 'settings-jurisdictions', path: '/admin/globals/consent-settings', prep: async (p) => p.getByRole('button', { name: 'Jurisdictions', exact: true }).click() },
  { name: 'settings-banner', path: '/admin/globals/consent-settings', prep: async (p) => p.getByRole('button', { name: 'Banner', exact: true }).click() },
  { name: 'settings-versions', path: '/admin/globals/consent-settings', prep: async (p) => p.getByRole('button', { name: 'Versions', exact: true }).click() },
  { name: 'categories', path: '/admin/collections/consent-categories' },
  { name: 'trackers', path: '/admin/collections/consent-trackers', nav: true },
  { name: 'tracker-edit', path: '/admin/collections/consent-trackers', prep: async (p) => { await p.getByRole('link', { name: 'Google Analytics 4' }).first().click(); await p.waitForURL(/consent-trackers\/\w+/) } , wait: 1500 },
  { name: 'processors', path: '/admin/collections/consent-processors' },
  { name: 'records', path: '/admin/collections/consent-records' },
  { name: 'legal-pages', path: '/admin/collections/legal-pages' },
  { name: 'legal-page-edit', path: '/admin/collections/legal-pages', prep: async (p) => { await p.getByRole('link', { name: 'Privacy Policy' }).first().click(); await p.waitForURL(/legal-pages\/\w+/); await p.mouse.wheel(0, 500) }, wait: 2000 },
  { name: 'banner', path: '/', locator: card('Your privacy choices'), wait: 1500 },
  { name: 'preferences', path: '/', prep: async (p) => { await p.getByRole('button', { name: 'Customize' }).click() }, locator: (p) => p.getByRole('dialog').first(), wait: 1200 },
  { name: 'legal-page-frontend', path: '/legal/privacy', prep: async (p) => { await p.getByRole('button', { name: 'Reject all' }).click().catch(() => {}) }, wait: 1500 },
]
