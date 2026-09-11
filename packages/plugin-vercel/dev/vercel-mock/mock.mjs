/**
 * In-memory stand-in for the parts of Vercel the plugin talks to: deploy hooks, the deployments API,
 * cancel and rollback. Deployments move QUEUED → BUILDING → READY on timers; a hook id containing
 * "fail" ends in ERROR. Repeated hits on the same hook cancel the older in-flight build, as Vercel does.
 *
 * Also serves `/__mock/*` control routes for tests: reset, config, state, and `POST /__mock/webhook-sign`.
 */
import { createHmac } from 'node:crypto'
import http from 'node:http'

/**
 * @typedef {{
 *   uid: string, name: string, projectId: string, url: string, inspectorUrl: string,
 *   readyState: 'QUEUED'|'BUILDING'|'READY'|'ERROR'|'CANCELED', source: string,
 *   target: 'production'|null, created: number, buildingAt?: number, ready?: number,
 *   errorCode?: string, errorMessage?: string|null, isRollbackCandidate?: boolean,
 *   meta: Record<string,string>, hookId?: string, readySubstate?: 'PROMOTED'|'STAGED',
 *   buildCache: boolean,
 * }} MockDeployment
 */

export function createMockVercel({ buildDelayMs = 300, buildTimeMs = 800, log = false } = {}) {
  /** @type {MockDeployment[]} */
  let deployments = []
  /** @type {{ buildDelayMs: number, buildTimeMs: number, failNext: number, hookStatus: number|null, apiStatus: number|null }} */
  const config = { apiStatus: null, buildDelayMs, buildTimeMs, failNext: 0, hookStatus: null }
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map()
  let counter = 0
  /** @type {{ method: string, path: string, at: number }[]} */
  const requests = []
  /** @type {string[]} */
  const rollbacks = []

  const clearTimer = (id) => {
    const t = timers.get(id)
    if (t) {
      clearTimeout(t)
      timers.delete(id)
    }
  }

  /** @param {MockDeployment} d */
  const advance = (d) => {
    const t1 = setTimeout(() => {
      if (d.readyState !== 'QUEUED') {
        return
      }
      d.readyState = 'BUILDING'
      d.buildingAt = Date.now()
      const t2 = setTimeout(() => {
        if (d.readyState !== 'BUILDING') {
          return
        }
        const fail = d.hookId?.includes('fail') || config.failNext > 0
        if (config.failNext > 0) {
          config.failNext--
        }
        if (fail) {
          d.readyState = 'ERROR'
          d.errorCode = 'BUILD_FAILED'
          d.errorMessage = 'Command "pnpm build" exited with 1'
        } else {
          d.readyState = 'READY'
          d.ready = Date.now()
          d.isRollbackCandidate = true
          if (d.target === 'production') {
            for (const other of deployments) {
              if (other !== d && other.target === 'production' && other.readyState === 'READY') {
                other.readySubstate = 'STAGED'
              }
            }
            d.readySubstate = 'PROMOTED'
          }
        }
        timers.delete(d.uid)
      }, config.buildTimeMs)
      timers.set(d.uid, t2)
    }, config.buildDelayMs)
    timers.set(d.uid, t1)
  }

  const createDeployment = ({ hookId, projectId, source = 'git-deploy-hook', target = 'production', buildCache = true }) => {
    counter++
    const uid = `dpl_${String(counter).padStart(6, '0')}${Math.random().toString(36).slice(2, 8)}`
    /** @type {MockDeployment} */
    const d = {
      buildCache,
      created: Date.now(),
      hookId,
      inspectorUrl: `https://vercel.com/mock/${projectId}/${uid}`,
      meta: hookId ? { deployHookId: hookId, deployHookName: hookId } : {},
      name: 'mock-site',
      projectId,
      readyState: 'QUEUED',
      source,
      target,
      uid,
      url: `mock-site-${uid.slice(4, 10)}.vercel.app`,
    }
    if (hookId) {
      for (const other of deployments) {
        if (other.hookId === hookId && (other.readyState === 'QUEUED' || other.readyState === 'BUILDING')) {
          other.readyState = 'CANCELED'
          other.errorMessage = 'Canceled: a newer deployment from the same deploy hook was created'
          clearTimer(other.uid)
        }
      }
    }
    deployments.push(d)
    advance(d)
    return d
  }

  const sendJson = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const readBody = (req) =>
    new Promise((resolve) => {
      let data = ''
      req.on('data', (c) => (data += c))
      req.on('end', () => resolve(data))
    })

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    const method = req.method ?? 'GET'
    requests.push({ at: Date.now(), method, path })
    if (log) {
      console.log(`[vercel-mock] ${method} ${path}${url.search}`)
    }

    // --- control routes ---
    if (path === '/__mock/reset') {
      for (const id of timers.keys()) {
        clearTimer(id)
      }
      deployments = []
      requests.length = 0
      rollbacks.length = 0
      config.failNext = 0
      config.hookStatus = null
      config.apiStatus = null
      const body = JSON.parse((await readBody(req)) || '{}')
      if (typeof body.buildDelayMs === 'number') {
        config.buildDelayMs = body.buildDelayMs
      }
      if (typeof body.buildTimeMs === 'number') {
        config.buildTimeMs = body.buildTimeMs
      }
      return sendJson(res, 200, { ok: true })
    }
    if (path === '/__mock/config') {
      Object.assign(config, JSON.parse((await readBody(req)) || '{}'))
      return sendJson(res, 200, config)
    }
    if (path === '/__mock/state') {
      return sendJson(res, 200, { config, deployments, requests, rollbacks })
    }
    if (path === '/__mock/external') {
      // Simulate a git push: a deployment nobody triggered through a hook.
      const body = JSON.parse((await readBody(req)) || '{}')
      const d = createDeployment({ projectId: body.projectId ?? 'prj_dev000000000000000000', source: 'git', target: body.target ?? 'production' })
      return sendJson(res, 200, d)
    }
    if (path === '/__mock/webhook-sign') {
      const raw = await readBody(req)
      const secret = url.searchParams.get('secret') ?? ''
      return sendJson(res, 200, { signature: createHmac('sha1', secret).update(raw).digest('hex') })
    }

    // --- deploy hook ---
    const hook = /^\/v1\/integrations\/deploy\/([^/]+)\/([^/]+)$/.exec(path)
    if (hook) {
      if (config.hookStatus) {
        return sendJson(res, config.hookStatus, { error: { code: 'mock', message: 'forced hook failure' } })
      }
      const [, projectId, hookId] = hook
      const target = hookId.includes('preview') ? null : 'production'
      const d = createDeployment({ buildCache: url.searchParams.get('buildCache') !== 'false', hookId, projectId, target })
      return sendJson(res, 201, { job: { createdAt: d.created, id: `job_${d.uid}`, state: 'PENDING' } })
    }

    // --- API (token required) ---
    const auth = req.headers.authorization ?? ''
    if (!auth.startsWith('Bearer ') || auth.length < 8) {
      return sendJson(res, 403, { error: { code: 'forbidden', message: 'Not authorized' } })
    }
    if (config.apiStatus) {
      return sendJson(res, config.apiStatus, { error: { code: 'mock', message: 'forced api failure' } })
    }

    if (path === '/v7/deployments' && method === 'GET') {
      const projectId = url.searchParams.get('projectId')
      const since = Number(url.searchParams.get('since') ?? 0)
      const until = Number(url.searchParams.get('until') ?? 0)
      const state = url.searchParams.get('state')
      const target = url.searchParams.get('target')
      const limit = Number(url.searchParams.get('limit') ?? 20)
      const list = deployments
        .filter((d) => !projectId || d.projectId === projectId)
        .filter((d) => !since || d.created >= since)
        .filter((d) => !until || d.created <= until)
        .filter((d) => !state || d.readyState === state)
        .filter((d) => !target || d.target === target)
        .sort((a, b) => b.created - a.created)
        .slice(0, limit)
        .map((d) => ({ ...d, state: d.readyState }))
      return sendJson(res, 200, { deployments: list, pagination: { count: list.length, next: null, prev: null } })
    }
    const get = /^\/v13\/deployments\/([^/]+)$/.exec(path)
    if (get && method === 'GET') {
      const d = deployments.find((x) => x.uid === get[1] || x.url === get[1])
      if (!d) {
        return sendJson(res, 404, { error: { code: 'not_found', message: 'Deployment not found' } })
      }
      return sendJson(res, 200, { ...d, id: d.uid, state: d.readyState })
    }
    const cancel = /^\/v12\/deployments\/([^/]+)\/cancel$/.exec(path)
    if (cancel && method === 'PATCH') {
      const d = deployments.find((x) => x.uid === cancel[1])
      if (!d) {
        return sendJson(res, 404, { error: { code: 'not_found', message: 'Deployment not found' } })
      }
      if (d.readyState === 'QUEUED' || d.readyState === 'BUILDING') {
        d.readyState = 'CANCELED'
        d.errorMessage = 'Canceled by user'
        clearTimer(d.uid)
      }
      return sendJson(res, 200, { ...d, id: d.uid, state: d.readyState })
    }
    const rollback = /^\/v1\/projects\/([^/]+)\/rollback\/([^/]+)$/.exec(path)
    if (rollback && method === 'POST') {
      const d = deployments.find((x) => x.uid === rollback[2])
      if (!d || d.readyState !== 'READY') {
        return sendJson(res, 400, { error: { code: 'bad_request', message: 'Not a rollback candidate' } })
      }
      rollbacks.push(d.uid)
      for (const other of deployments) {
        if (other.target === 'production' && other.readyState === 'READY') {
          other.readySubstate = other === d ? 'PROMOTED' : 'STAGED'
        }
      }
      return sendJson(res, 200, {})
    }
    return sendJson(res, 404, { error: { code: 'not_found', message: `No mock route for ${method} ${path}` } })
  })

  return {
    config,
    /** @param {number} [port] */
    listen(port = 3399) {
      return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${port}`)))
    },
    close() {
      for (const id of timers.keys()) {
        clearTimer(id)
      }
      return new Promise((resolve) => server.close(() => resolve(undefined)))
    },
    get deployments() {
      return deployments
    },
    get requests() {
      return requests
    },
    get rollbacks() {
      return rollbacks
    },
    /** Deterministic helper for tests: finish every in-flight build now. */
    settle() {
      for (const d of deployments) {
        if (d.readyState === 'QUEUED' || d.readyState === 'BUILDING') {
          clearTimer(d.uid)
          d.readyState = 'READY'
          d.buildingAt = d.buildingAt ?? Date.now()
          d.ready = Date.now()
          d.isRollbackCandidate = true
          d.readySubstate = d.target === 'production' ? 'PROMOTED' : undefined
        }
      }
    },
  }
}
