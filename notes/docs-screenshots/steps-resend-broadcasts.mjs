export const steps = [
  { name: 'campaigns', path: '/admin/collections/newsletter-campaigns', nav: true },
  { name: 'campaign-edit', path: '/admin/collections/newsletter-campaigns/1', wait: 2500 },
  { name: 'preview', path: '/admin/collections/newsletter-campaigns/1/preview', wait: 3500 },
  { name: 'preview-dark-email', path: '/admin/collections/newsletter-campaigns/1/preview', wait: 2500, prep: async (p) => { await p.getByText('Dark', { exact: true }).first().click() } },
  { name: 'preview-send', path: '/admin/collections/newsletter-campaigns/1/preview', wait: 2500, prep: async (p) => { await p.waitForTimeout(2000); await p.getByText('Send a test', { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'start' })); } },
  { name: 'campaign-scheduled', path: '/admin/collections/newsletter-campaigns/3', wait: 2500 },
  { name: 'lists', path: '/admin/collections/newsletter-lists' },
  { name: 'list-edit', path: '/admin/collections/newsletter-lists/1', wait: 2000 },
  { name: 'subscribers', path: '/admin/collections/subscribers' },
  { name: 'settings', path: '/admin/globals/newsletter-settings', wait: 2000 },
  { name: 'sync-runs', path: '/admin/collections/newsletter-sync-runs' },
]
