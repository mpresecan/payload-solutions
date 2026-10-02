import { client, para } from './rest.mjs'
const api = await client('http://localhost:3500')
const mk = async (name, list, subject, text) => (await api.post('/newsletter-campaigns', { name, list, subject, previewText: subject, body: para(text) })).doc
const sep = await mk('September roundup', 1, 'September at {{site.name}}', 'Hi {{firstName|there}},\nA short look back at September.')
console.log(JSON.stringify(await api.post(`/newsletter-campaigns/${sep.id}/send`, {})).slice(0, 200))
const pro = await mk('Pro plan: new limits', 2, 'Your Pro plan just got bigger', 'Hi {{firstName|there}},\nPro now includes twice the storage.')
console.log(JSON.stringify(await api.post(`/newsletter-campaigns/${pro.id}/send`, { scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString() })).slice(0, 200))
await mk('November product update', 1, 'What shipped in November', 'Hi {{firstName|there}},\nDraft.')
await new Promise((r) => setTimeout(r, 4000))
console.log(JSON.stringify(await api.post(`/newsletter-campaigns/${sep.id}/refresh`, {})).slice(0, 200))
const r = await api.get('/newsletter-campaigns?limit=10&depth=0'); console.log(r.docs.map((d) => d.id + ' ' + d.name + ' ' + d.status))
