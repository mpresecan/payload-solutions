import { client, para } from './rest.mjs'
const api = await client('http://localhost:3300')
await api.post('/globals/email-settings', {
  from: { name: 'Acme', address: 'hello@acme.dev' }, replyTo: 'support@acme.dev',
  adminRecipients: [{ email: 'team@acme.dev' }], testRecipient: 'ada@acme.dev',
  siteName: 'Acme', siteUrl: 'https://acme.dev',
  footer: para('Acme Inc. · 1 Market Street, San Francisco\nYou are receiving this because you have an account on Acme.'),
})
await api.patch('/users/1', { name: 'Dev Admin' })
for (const [name, email] of [['Ada Lovelace', 'ada@acme.dev'], ['Grace Hopper', 'grace@acme.dev'], ['Alan Turing', 'alan@acme.dev']]) {
  await api.post('/users', { name, email, password: 'test1234' })
}
console.log((await api.get('/email-log?limit=20')).totalDocs, 'log rows')
