export const steps = [
  { name: 'list', path: '/admin/collections/transactional-emails', nav: true },
  { name: 'editor', path: '/admin/collections/transactional-emails/1' },
  { name: 'preview', path: '/admin/collections/transactional-emails/1/preview',
    prep: async (page, theme) => { if (theme === 'dark') await page.getByText('Dark', { exact: true }).first().click() }, wait: 1500 },
  { name: 'preview-mobile', path: '/admin/collections/transactional-emails/1/preview',
    prep: async (page) => { await page.getByRole('button', { name: 'Mobile', exact: true }).click() }, wait: 1500 },
  { name: 'settings-template', path: '/admin/globals/email-settings',
    prep: async (page) => { await page.getByRole('button', { name: 'Template', exact: true }).click() }, wait: 2000 },
  { name: 'settings-content', path: '/admin/globals/email-settings',
    prep: async (page) => { await page.getByRole('button', { name: 'Content', exact: true }).click() } },
  { name: 'log', path: '/admin/collections/email-log', nav: true },
]
