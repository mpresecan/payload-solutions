'use client'
import { useConfig } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useCallback } from 'react'

/** Calls the plugin's REST endpoints with the admin's session cookie. */
export function useRequest() {
  const {
    config: { routes, serverURL },
  } = useConfig()

  return useCallback(
    async <T>(
      path: string,
      init: { body?: unknown; method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' } = {},
    ): Promise<T> => {
      const method = init.method ?? (init.body === undefined ? 'GET' : 'POST')
      const res = await fetch(
        formatAdminURL({ apiRoute: routes.api, path: path as `/${string}`, serverURL }),
        {
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method,
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        errors?: Array<{ message?: string }>
        message?: string
      } & T
      if (!res.ok) {
        throw new Error(
          data.message ?? data.errors?.[0]?.message ?? `Request failed (${res.status})`,
        )
      }
      return data
    },
    [routes.api, serverURL],
  )
}

export type SyncRun = {
  errors?: null | string[]
  finishedAt?: null | string
  id: number | string
  startedAt?: null | string
  stats?: null | Record<string, number>
  status: 'failed' | 'finished' | 'running'
}

export function describeRun(run: SyncRun): string {
  const s = run.stats ?? {}
  const parts = [
    s.contactsCreated ? `${s.contactsCreated} contacts created` : null,
    s.contactsUpdated ? `${s.contactsUpdated} updated` : null,
    s.segmentAdds ? `${s.segmentAdds} added to segments` : null,
    s.segmentRemovals ? `${s.segmentRemovals} removed` : null,
    s.pulledUnsubscribes ? `${s.pulledUnsubscribes} unsubscribes pulled from Resend` : null,
  ].filter(Boolean)
  const summary = parts.length ? parts.join(', ') : 'nothing to change'
  if (run.status === 'running') {
    return `Syncing… ${parts.length ? summary : ''}`.trim()
  }
  if (run.status === 'failed') {
    return `Finished with ${run.errors?.length ?? 0} error${run.errors?.length === 1 ? '' : 's'}: ${run.errors?.[0] ?? ''}`
  }
  return `In sync — ${summary}.`
}

/** Poll a sync run until it stops running. */
export async function waitForRun(
  request: ReturnType<typeof useRequest>,
  slug: string,
  id: number | string,
  onUpdate: (run: SyncRun) => void,
): Promise<SyncRun> {
  for (;;) {
    const run = await request<SyncRun>(`/${slug}/${id}?depth=0`)
    onUpdate(run)
    if (run.status !== 'running') {
      return run
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
