import { client } from './rest.mjs'
const api = await client('http://localhost:3400')
const mock = (p, d) => fetch(`http://localhost:3399/__mock/${p}`, { method: 'POST', body: JSON.stringify(d ?? {}) }).then((r) => r.json())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = await api.get('/vercel/status'); console.log(JSON.stringify(st).slice(0, 400))
const deploy = (target, reason) => api.post('/vercel/deploy', { target, reason })
// round 1
await api.post('/posts', { title: 'Hello world', excerpt: 'First post' })
await api.post('/pages', { title: 'About', body: 'About us', _status: 'published' })
console.log(JSON.stringify(await deploy('production', 'Initial launch')).slice(0, 200))
await sleep(5000)
await deploy('staging', 'Preview of the new pricing page'); await sleep(5000)
// round 2: failure
await api.post('/posts', { title: 'Release notes 1.2' })
await mock('config', { failNext: 1 })
await deploy('production', 'Release notes'); await sleep(5000)
// round 3: fix
await api.post('/posts', { title: 'Release notes 1.2.1' })
await deploy('production'); await sleep(5000)
await mock('external'); await sleep(5000)
// pending changes
await api.post('/pages', { title: 'Pricing', body: 'Plans', _status: 'published' })
const p = await api.post('/posts', { title: 'Announcing our Vercel integration', excerpt: 'Deploy from the admin.' })
await api.patch(`/posts/${p.doc.id}`, { excerpt: 'Deploy straight from the Payload admin.' })
await api.post('/globals/site-settings', { })
console.log(JSON.stringify(await api.get('/vercel/status')).slice(0, 1500))
