export async function client(base) {
  const r = await fetch(`${base}/api/users/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'dev@payloadcms.com', password: 'test' }) })
  const { token } = await r.json()
  const call = async (method, path, data) => {
    const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `JWT ${token}` }, body: data ? JSON.stringify(data) : undefined })
    const text = await res.text()
    let json; try { json = JSON.parse(text) } catch { json = text }
    if (!res.ok) console.error(method, path, res.status, typeof json === 'string' ? json.slice(0, 300) : JSON.stringify(json).slice(0, 500))
    return json
  }
  return { get: (p) => call('GET', p), post: (p, d) => call('POST', p, d), patch: (p, d) => call('PATCH', p, d), del: (p) => call('DELETE', p), token }
}
export const para = (text) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: text.split('\n').map((t) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, children: [{ type: 'text', text: t, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] })) } })
