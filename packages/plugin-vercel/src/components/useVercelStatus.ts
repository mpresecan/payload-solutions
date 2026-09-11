'use client'
import { useConfig } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { StatusResponse } from './api.js'

import { fetchStatus, invalidateStatus, sendFlushBeacon, subscribeStatus } from './api.js'

const FAST_MS = 10_000
const SLOW_MS = 60_000

function needsFastPolling(data: null | StatusResponse): boolean {
  return Boolean(data?.targets.some((t) => t.pendingCount > 0 || t.dueAt || t.inFlight))
}

/**
 * Shared status for every widget: one poll loop per page, 10 s while something is pending or building,
 * 60 s otherwise, paused while the tab is hidden. Each poll is a heartbeat tick on the server.
 */
export function useVercelStatus(options: { poll?: boolean } = {}) {
  const { config } = useConfig()
  const apiRoute = config.routes.api
  const [error, setError] = useState<null | string>(null)
  const [now, setNow] = useState(() => Date.now())
  const timer = useRef<null | ReturnType<typeof setTimeout>>(null)
  const poll = options.poll ?? true

  const data = useSyncExternalStore(
    (cb) => subscribeStatus(() => cb()),
    () => snapshot,
    () => null,
  )

  const refresh = useCallback(
    async (opts: { tick?: boolean } = {}) => {
      try {
        invalidateStatus()
        const next = await fetchStatus(apiRoute, { maxAgeMs: 0, tick: opts.tick })
        snapshot = next
        setError(null)
        return next
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return null
      }
    },
    [apiRoute],
  )

  useEffect(() => {
    if (!poll) {
      return
    }
    let cancelled = false
    const schedule = (ms: number) => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = setTimeout(run, ms)
    }
    const run = async () => {
      if (cancelled) {
        return
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedule(FAST_MS)
        return
      }
      const next = await refresh()
      schedule(needsFastPolling(next) ? FAST_MS : SLOW_MS)
    }
    void run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void run()
      } else if (snapshot?.beacon && snapshot.targets.some((t) => t.dueAt)) {
        sendFlushBeacon(apiRoute)
      }
    }
    const onPageHide = () => {
      if (snapshot?.beacon && snapshot.targets.some((t) => t.dueAt)) {
        sendFlushBeacon(apiRoute)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      cancelled = true
      if (timer.current) {
        clearTimeout(timer.current)
      }
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [apiRoute, poll, refresh])

  // A one-second clock for countdowns and "x s ago" labels.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return { apiRoute, data, error, now, refresh }
}

let snapshot: null | StatusResponse = null
subscribeStatus((next) => {
  snapshot = next
})
