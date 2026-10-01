'use client'
import {
  Button,
  Link,
  Pill,
  toast,
  useConfig,
  useDocumentInfo,
  useFormFields,
} from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import { formatAdminURL } from 'payload/shared'
import React, { useEffect, useState } from 'react'

import type { CampaignStatus as Status } from '../types.js'
import type { SyncRun } from './api.js'

import { describeRun, useRequest, waitForRun } from './api.js'
import './preview.css'

const STATUS_LABEL: Record<
  Status,
  { label: string; style: 'dark' | 'error' | 'light-gray' | 'success' | 'warning' }
> = {
  draft: { label: 'Draft', style: 'light-gray' },
  failed: { label: 'Failed', style: 'error' },
  scheduled: { label: 'Scheduled', style: 'warning' },
  sending: { label: 'Sending', style: 'dark' },
  sent: { label: 'Sent', style: 'success' },
}

/** Campaign sidebar: where it stands, and the way to Preview & send. */
export const CampaignStatus: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const {
    config: { routes },
  } = useConfig()
  const status =
    (useFormFields(([fields]) => fields.status?.value) as Status | undefined) ?? 'draft'
  const scheduledAt = useFormFields(([fields]) => fields.scheduledAt?.value) as string | undefined
  const { label, style } = STATUS_LABEL[status] ?? STATUS_LABEL.draft

  return (
    <div className="newsletter-side">
      <div className="newsletter-side__row">
        <Pill pillStyle={style} size="small">
          {label}
        </Pill>
        {status === 'scheduled' && scheduledAt && (
          <span>{new Date(scheduledAt).toLocaleString()}</span>
        )}
      </div>
      {id ? (
        <Link
          href={formatAdminURL({
            adminRoute: routes.admin,
            path: `/collections/${collectionSlug}/${id}/preview`,
          })}
        >
          Preview & send →
        </Link>
      ) : (
        <p className="newsletter-side__hint">
          Save the campaign to preview it as any subscriber and send it.
        </p>
      )}
      {(status === 'scheduled' || status === 'sending' || status === 'sent') && (
        <p className="newsletter-side__hint">The copy is locked while Resend has it.</p>
      )}
    </div>
  )
}

/** List sidebar: rebuild this list's segment on demand and watch the run. */
export const ListSyncStatus: React.FC<{ runsSlug?: string }> = ({ runsSlug }) => {
  const { id, collectionSlug: listsSlug } = useDocumentInfo()
  const request = useRequest()
  const router = useRouter()
  const [run, setRun] = useState<null | SyncRun>(null)
  const [isRunning, setIsRunning] = useState(false)

  if (!id) {
    return (
      <p className="newsletter-side__hint">
        Saving creates the Resend segment and fills it in the background.
      </p>
    )
  }

  const resync = async () => {
    if (!runsSlug) {
      return
    }
    setIsRunning(true)
    try {
      const { runId } = await request<{ runId: number | string }>(`/${listsSlug}/${id}/resync`, {
        body: {},
      })
      const done = await waitForRun(request, runsSlug, runId, setRun)
      if (done.status === 'failed') {
        toast.error(describeRun(done))
      } else {
        toast.success('List is in sync with Resend')
      }
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Resync failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="newsletter-side">
      <Button
        buttonStyle="secondary"
        disabled={isRunning}
        onClick={() => void resync()}
        size="small"
      >
        {isRunning ? 'Syncing…' : 'Resync with Resend'}
      </Button>
      <p className="newsletter-side__hint">
        {run ? describeRun(run) : 'Rebuilds this segment from the documents the filter matches.'}
      </p>
    </div>
  )
}

/** Above the Lists table: reconcile everything with Resend, and show how the last run went. */
export const ResyncAllButton: React.FC<{ runsSlug?: string }> = ({ runsSlug }) => {
  const request = useRequest()
  const router = useRouter()
  const [run, setRun] = useState<null | SyncRun>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!runsSlug) {
      return
    }
    request<{ docs: SyncRun[] }>(`/${runsSlug}?limit=1&sort=-createdAt&depth=0`)
      .then((data) => setRun(data.docs[0] ?? null))
      .catch(() => undefined)
  }, [request, runsSlug])

  const resync = async () => {
    if (!runsSlug) {
      return
    }
    setIsRunning(true)
    try {
      const { runId } = await request<{ runId: number | string }>('/resend-broadcasts/resync', {
        body: {},
      })
      const done = await waitForRun(request, runsSlug, runId, setRun)
      if (done.status === 'failed') {
        toast.error(describeRun(done))
      } else {
        toast.success('Everything is in sync with Resend')
      }
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Resync failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="newsletter-resync-all">
      <Button
        buttonStyle="secondary"
        disabled={isRunning}
        onClick={() => void resync()}
        size="small"
      >
        {isRunning ? 'Syncing with Resend…' : 'Resync everything with Resend'}
      </Button>
      {run && (
        <span className="newsletter-resync-all__summary">
          {run.status === 'running' || isRunning
            ? describeRun(run)
            : `Last run ${run.finishedAt ? new Date(run.finishedAt).toLocaleString() : ''}: ${describeRun(run)}`}
        </span>
      )}
    </div>
  )
}
