const row = (p, text) => p.locator('table tbody tr').filter({ hasText: text }).first()
export const steps = [
  { name: 'list', path: '/admin/collections/scheduled-actions', wait: 2500 },
  { name: 'list-nav', path: '/admin/collections/scheduled-actions', nav: true, wait: 2500 },
  { name: 'row-menu', path: '/admin/collections/scheduled-actions', prep: async (p) => { await row(p, 'Pending').locator('button').last().click() }, wait: 1000 },
  { name: 'log-drawer', path: '/admin/collections/scheduled-actions', prep: async (p) => { await row(p, 'slack').getByText('view log').click() }, wait: 2000 },
  { name: 'detail-failed', path: '/admin/collections/scheduled-actions/6', wait: 2000 },
  { name: 'create', path: '/admin/collections/scheduled-actions/create', wait: 2000 },
]
