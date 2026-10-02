import { randomUUID } from 'node:crypto'
const base = 'http://localhost:3320'
const cfg = await (await fetch(`${base}/api/consent/config`)).json()
console.log(Object.keys(cfg), cfg.versions)
const combos = [
  { analytics: true, marketing: true, functional: true },
  { analytics: false, marketing: false, functional: false },
  { analytics: true, marketing: false, functional: true },
  { analytics: true, marketing: false, functional: false },
]
const sources = ['banner', 'banner', 'preferences', 'banner', 'banner', 'withdraw', 'banner', 'preferences']
const countries = ['DE', 'FR', 'PL', 'HR', 'NL', 'GB', 'ES', 'IT', 'SE', 'AT', 'BE', 'IE']
let ok = 0
for (let i = 0; i < 18; i++) {
  const r = await fetch(`${base}/api/consent/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.${i}.1`, 'cf-ipcountry': countries[i % countries.length], 'x-vercel-ip-country': countries[i % countries.length] },
    body: JSON.stringify({ consentId: randomUUID(), decisions: combos[i % combos.length], versions: cfg.versions, source: sources[i % sources.length], locale: 'en' }),
  })
  if (r.status === 201) ok++; else console.log(r.status, (await r.text()).slice(0, 200))
}
console.log('records', ok)
