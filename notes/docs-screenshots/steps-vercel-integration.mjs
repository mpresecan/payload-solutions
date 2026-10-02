const header = (p) => p.locator('.plugin-vercel-header')
export const steps = [
  { name: 'header', path: '/admin', wait: 4000, clip: { x: 640, y: 0, width: 800, height: 56 } },
  { name: 'header-menu', path: '/admin', wait: 1000, prep: async (p) => { await p.waitForTimeout(3000); await header(p).locator('.popup-button, [class*="popup__trigger"]').first().click().catch(async () => header(p).getByText(/Website:/).click()); await p.mouse.move(200, 600) }, clip: { x: 640, y: 0, width: 800, height: 200 } },
  { name: 'deploy-drawer', path: '/admin', prep: async (p) => { await p.waitForTimeout(3000); await header(p).getByRole('button', { name: /^Deploy/ }).first().click(); await p.waitForTimeout(800); await p.getByPlaceholder('Why this deployment?').fill('Publish the pricing page') }, wait: 1200 },
  { name: 'deployments-view', path: '/admin/deployments', nav: true, wait: 2000, prep: async (p) => { await header(p).getByRole('button', { name: /^Deploy/ }).first().waitFor() } },
  { name: 'deployments-history', path: '/admin/deployments', wait: 4000, prep: async (p) => { await p.getByRole('heading', { name: 'History' }).first().scrollIntoViewIfNeeded(); await p.mouse.wheel(0, -120) } },
  { name: 'document-pill', path: '/admin/collections/pages/2', wait: 3000, prep: async (p) => { await p.locator('.plugin-vercel-document-pill').waitFor() } },
  { name: 'deployments-collection', path: '/admin/collections/vercel-deployments', wait: 6000 },
]
