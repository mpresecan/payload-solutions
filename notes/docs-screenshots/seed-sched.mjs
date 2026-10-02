import { client } from './rest.mjs'
const api = await client('http://localhost:3310')
const now = Date.now(), m = 60_000
const mk = (d) => api.post('/scheduled-actions', d).then((r) => r.doc?.id ?? r)
// due now -> will run on run-queue
for (const id of ['A-1042', 'A-1043', 'paid', 'A-1047']) await mk({ hook: 'orders.remind', args: { orderId: id }, repeat: 'once' })
await mk({ hook: 'webhooks.deliver', args: { endpointId: 'crm', permanent: true }, repeat: 'once', group: 'integrations' })
await mk({ hook: 'webhooks.deliver', args: { endpointId: 'slack', succeedOn: 3 }, repeat: 'once', group: 'integrations' })
await mk({ hook: 'media.optimize', args: { ms: 2000 }, repeat: 'once', group: 'media' })
await mk({ hook: 'media.optimize', args: { ms: 50 }, repeat: 'once', group: 'media' })
let r = await api.post('/scheduled-actions/scheduler/run-queue', {})
console.log('run1', JSON.stringify(r).slice(0, 300))
// future
await mk({ hook: 'orders.remind', args: { orderId: 'A-1051' }, repeat: 'once', scheduleAt: new Date(now + 12 * m).toISOString(), priority: 5 })
await mk({ hook: 'orders.remind', args: { orderId: 'A-1052' }, repeat: 'once', scheduleAt: new Date(now + 3 * 60 * m).toISOString() })
await mk({ hook: 'webhooks.deliver', args: { endpointId: 'billing' }, repeat: 'interval', interval: 900, scheduleAt: new Date(now + 7 * m).toISOString(), group: 'integrations' })
await mk({ hook: 'analytics.rollup', repeat: 'cron', cron: '0 9 * * 1', tz: 'Europe/Warsaw', group: 'analytics' })
// one past due (scheduled in the past, not run)
const past = await mk({ hook: 'orders.remind', args: { orderId: 'A-1039' }, repeat: 'once', scheduleAt: new Date(now - 4 * m).toISOString() })
// one canceled
const c = await mk({ hook: 'orders.remind', args: { orderId: 'A-1040' }, repeat: 'once', scheduleAt: new Date(now + 60 * m).toISOString() })
console.log('cancel', JSON.stringify(await api.post(`/scheduled-actions/${c}/cancel`, {})).slice(0, 200))
const counts = await api.get('/scheduled-actions/scheduler/counts'); console.log(JSON.stringify(counts))
