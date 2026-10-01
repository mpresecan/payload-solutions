'use client'
import {
  Banner,
  Button,
  ConfirmationModal,
  DatePicker,
  Pill,
  SelectInput,
  ShimmerEffect,
  TextInput,
  toast,
  useModal,
} from '@payloadcms/ui'
import * as qs from 'qs-esm'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ColorScheme } from '../render/color-scheme.js'
import type { CampaignStatus, Subscriber, VariableInfo } from '../types.js'

import { forceColorScheme } from '../render/color-scheme.js'
import { useRequest } from './api.js'
import { VariablesPanel } from './VariablesPanel.js'
import './preview.css'

type Props = {
  campaignsSlug: string
  id: string
  initialListId: null | string
  lists: Array<{ id: string; name: string }>
  listsSlug: string
  testRecipient: string
}

type PreviewResponse = {
  campaign: {
    broadcastId: null | string
    lastError: null | string
    scheduledAt: null | string
    sentAt: null | string
    status: CampaignStatus
  }
  html: string
  isSample: boolean
  list: {
    id: number | string
    lastSyncedAt: null | string
    memberCount: null | number
    name: string
    segmentId: null | string
    source: string
  } | null
  preheader?: string
  privateImages?: string[]
  subject: string
  subscriber: Subscriber
  text: string
  variables: Array<{ used: boolean; value: string } & VariableInfo>
}

type SubscribersPage = { docs: Subscriber[]; page: number; totalDocs: number; totalPages: number }

const baseClass = 'newsletter-preview'
const PAGE_SIZE = 8

const STATUS_PILL: Record<
  CampaignStatus,
  { label: string; style: 'dark' | 'error' | 'light' | 'light-gray' | 'success' | 'warning' }
> = {
  draft: { label: 'Draft', style: 'light-gray' },
  failed: { label: 'Failed', style: 'error' },
  scheduled: { label: 'Scheduled', style: 'warning' },
  sending: { label: 'Sending', style: 'dark' },
  sent: { label: 'Sent', style: 'success' },
}

const formatDate = (value: null | string) => (value ? new Date(value).toLocaleString() : '')

function BodySkeleton() {
  return (
    <div className={`${baseClass}__skeleton-body`}>
      <ShimmerEffect height={26} width="55%" />
      <ShimmerEffect animationDelay="60ms" height={14} />
      <ShimmerEffect animationDelay="90ms" height={14} />
      <ShimmerEffect animationDelay="120ms" height={14} width="80%" />
      <ShimmerEffect animationDelay="180ms" height={40} width="45%" />
      <ShimmerEffect animationDelay="240ms" height={14} />
      <ShimmerEffect animationDelay="270ms" height={14} width="65%" />
    </div>
  )
}

/**
 * Preview & send. Left: who it goes to (the list, and any one person in it to preview as), a test
 * send, the send/schedule controls, and the variables with this person's values. Right: the email
 * exactly as that person would get it.
 */
export const CampaignPreviewClient: React.FC<Props> = ({
  id,
  campaignsSlug,
  initialListId,
  lists,
  listsSlug,
  testRecipient,
}) => {
  const request = useRequest()
  const { closeModal, openModal } = useModal()

  const [listId, setListId] = useState<null | string>(initialListId)
  const [subscriber, setSubscriber] = useState<null | Subscriber>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [people, setPeople] = useState<null | SubscribersPage>(null)
  const [peopleLoading, setPeopleLoading] = useState(false)

  const [preview, setPreview] = useState<null | PreviewResponse>(null)
  const [renderCount, setRenderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSkeleton, setShowSkeleton] = useState(true)
  const [mode, setMode] = useState<'html' | 'text'>('html')
  const [width, setWidth] = useState<375 | 640>(640)
  const [scheme, setScheme] = useState<ColorScheme>('light')
  const [isExpanded, setIsExpanded] = useState(false)

  const [to, setTo] = useState(testRecipient)
  const [sendingTest, setSendingTest] = useState(false)
  const [when, setWhen] = useState<'later' | 'now'>('now')
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)
  const subscriberRef = useRef<null | Subscriber>(null)
  subscriberRef.current = subscriber

  const confirmSendSlug = `newsletter-send-${id}`
  const confirmCancelSlug = `newsletter-cancel-${id}`
  const status = preview?.campaign.status ?? 'draft'
  const isLocked = status === 'scheduled' || status === 'sending' || status === 'sent'
  const html = useMemo(() => forceColorScheme(preview?.html ?? '', scheme), [preview?.html, scheme])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const current = subscriberRef.current
      const data = await request<PreviewResponse>(`/${campaignsSlug}/${id}/preview`, {
        body: {
          subscriber:
            current && current.id !== 'sample'
              ? { id: current.id, collection: current.collection }
              : undefined,
        },
      })
      setPreview(data)
      setRenderCount((n) => n + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }, [campaignsSlug, id, request])

  // Wait for the list's first page before the first render, so the preview opens on a real person
  // rather than flashing the sample subscriber first.
  const isReady = !listId || people !== null
  useEffect(() => {
    if (isReady) {
      void load()
    }
  }, [isReady, load, subscriber])

  // Skeleton at once on the first render; later only if slow enough to notice.
  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false)
      return
    }
    if (!preview) {
      setShowSkeleton(true)
      return
    }
    const timer = setTimeout(() => setShowSkeleton(true), 300)
    return () => clearTimeout(timer)
  }, [loading, preview])

  // The members of the chosen list, searchable and paged.
  useEffect(() => {
    if (!listId) {
      setPeople(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(
      async () => {
        setPeopleLoading(true)
        try {
          const query = qs.stringify(
            { limit: PAGE_SIZE, page, search: search.trim() || undefined },
            { addQueryPrefix: true },
          )
          const data = await request<SubscribersPage>(`/${listsSlug}/${listId}/subscribers${query}`)
          if (!cancelled) {
            setPeople(data)
            // Preview as the first person in the list until someone is picked.
            if (!subscriberRef.current && data.docs[0]) {
              setSubscriber(data.docs[0])
            }
          }
        } catch (error) {
          if (!cancelled) {
            setPeople({ docs: [], page: 1, totalDocs: 0, totalPages: 0 })
            toast.error(error instanceof Error ? error.message : 'Could not load subscribers')
          }
        } finally {
          if (!cancelled) {
            setPeopleLoading(false)
          }
        }
      },
      search ? 300 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [listId, listsSlug, page, request, search])

  const changeList = async (next: string) => {
    if (next === listId) {
      return
    }
    try {
      await request(`/${campaignsSlug}/${id}`, { body: { list: next }, method: 'PATCH' })
      setListId(next)
      setPage(1)
      setSearch('')
      setSubscriber(null)
      toast.success('Audience updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the list')
    }
  }

  // Step through the list with the arrows, crossing page boundaries.
  const step = async (direction: -1 | 1) => {
    if (!people || !subscriber) {
      return
    }
    const index = people.docs.findIndex(
      (p) => p.id === subscriber.id && p.collection === subscriber.collection,
    )
    const nextIndex = index + direction
    if (nextIndex >= 0 && nextIndex < people.docs.length) {
      setSubscriber(people.docs[nextIndex])
      return
    }
    const nextPage = people.page + direction
    if (nextPage < 1 || nextPage > people.totalPages) {
      return
    }
    const query = qs.stringify(
      { limit: PAGE_SIZE, page: nextPage, search: search.trim() || undefined },
      { addQueryPrefix: true },
    )
    const data = await request<SubscribersPage>(`/${listsSlug}/${listId}/subscribers${query}`)
    setPeople(data)
    setPage(nextPage)
    const target = direction === 1 ? data.docs[0] : data.docs[data.docs.length - 1]
    if (target) {
      setSubscriber(target)
    }
  }

  const position = useMemo(() => {
    if (!people || !subscriber) {
      return null
    }
    const index = people.docs.findIndex(
      (p) => p.id === subscriber.id && p.collection === subscriber.collection,
    )
    return index === -1 ? null : (people.page - 1) * PAGE_SIZE + index + 1
  }, [people, subscriber])

  const sendTest = async () => {
    setSendingTest(true)
    try {
      await request(`/${campaignsSlug}/${id}/test`, {
        body: {
          subscriber:
            subscriber && subscriber.id !== 'sample'
              ? { id: subscriber.id, collection: subscriber.collection }
              : undefined,
          to,
        },
      })
      toast.success(
        `Test sent to ${to}${subscriber ? `, filled in as ${subscriber.name || subscriber.email}` : ''}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test send failed')
    } finally {
      setSendingTest(false)
    }
  }

  const act = async (action: 'cancel' | 'refresh' | 'send', body?: unknown) => {
    setBusy(true)
    try {
      await request(`/${campaignsSlug}/${id}/${action}`, { body: body ?? {} })
      if (action === 'send') {
        toast.success(when === 'later' ? 'Scheduled with Resend' : 'Handed to Resend for delivery')
      } else if (action === 'cancel') {
        toast.success('Send cancelled — the campaign is a draft again')
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const list = preview?.list
  const audience = list?.memberCount ?? null
  const canSend =
    !isLocked &&
    Boolean(list?.segmentId) &&
    !preview?.privateImages?.length &&
    (when === 'now' || Boolean(scheduledAt))

  return (
    <div
      className={[baseClass, isExpanded && `${baseClass}--is-expanded`].filter(Boolean).join(' ')}
    >
      <div className={`${baseClass}__fields`}>
        <section className={`${baseClass}__panel`}>
          <h3 className={`${baseClass}__panel-title`}>Audience</h3>
          <p className={`${baseClass}__hint`}>
            The list this campaign goes to. Pick anyone in it to see the email exactly as they will
            — names, fallbacks and all.
          </p>
          <SelectInput
            isClearable={false}
            label="Send to"
            name="newsletter-list"
            onChange={(option) =>
              void changeList(String((option as { value?: unknown })?.value ?? ''))
            }
            options={lists.map((l) => ({ label: l.name, value: l.id }))}
            path="newsletter-list"
            readOnly={isLocked}
            value={listId ?? ''}
          />
          {list && (
            <div className={`${baseClass}__list-meta`}>
              <span>
                {audience === null ? 'Not synced yet' : `${audience} subscribed in Resend`}
              </span>
              {list.lastSyncedAt && <span>synced {formatDate(list.lastSyncedAt)}</span>}
              {list.segmentId && <code title="Resend segment">{list.segmentId}</code>}
            </div>
          )}

          <TextInput
            hasMany={false}
            label="Find a subscriber"
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            path="newsletter-subscriber-search"
            placeholder="Name or email"
            value={search}
          />
          <div className={`${baseClass}__people`}>
            {peopleLoading && !people ? (
              <div className={`${baseClass}__empty`}>
                <ShimmerEffect height={14} width="70%" />
              </div>
            ) : people?.docs.length ? (
              people.docs.map((person) => {
                const isActive =
                  subscriber?.id === person.id && subscriber?.collection === person.collection
                return (
                  <button
                    className={[
                      `${baseClass}__person`,
                      isActive && `${baseClass}__person--is-active`,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={`${person.collection}:${person.id}`}
                    onClick={() => setSubscriber(person)}
                    type="button"
                  >
                    <span className={`${baseClass}__person-name`}>
                      {person.name || person.email}
                    </span>
                    <span className={`${baseClass}__person-email`}>{person.email}</span>
                    {!person.subscribed && (
                      <Pill pillStyle="light-gray" size="small">
                        Unsubscribed
                      </Pill>
                    )}
                  </button>
                )
              })
            ) : (
              <p className={`${baseClass}__empty`}>
                {search
                  ? 'Nobody in this list matches.'
                  : 'Nobody in this list yet — previewing a sample subscriber.'}
              </p>
            )}
          </div>
          <div className={`${baseClass}__pager`}>
            <Button
              buttonStyle="transparent"
              disabled={!position || position <= 1}
              onClick={() => void step(-1)}
              size="small"
            >
              ← Previous
            </Button>
            <span>
              {people && position
                ? `${position} of ${people.totalDocs}`
                : people
                  ? `${people.totalDocs} in list`
                  : ''}
            </span>
            <Button
              buttonStyle="transparent"
              disabled={!people || !position || position >= people.totalDocs}
              onClick={() => void step(1)}
              size="small"
            >
              Next →
            </Button>
          </div>
        </section>

        <section className={`${baseClass}__panel`}>
          <h3 className={`${baseClass}__panel-title`}>Send a test</h3>
          <TextInput
            hasMany={false}
            label="Recipient"
            onChange={(event) => setTo(event.target.value)}
            path="newsletter-test-recipient"
            placeholder="you@example.com"
            value={to}
          />
          <div className={`${baseClass}__panel-actions`}>
            <Button disabled={sendingTest || !to} onClick={() => void sendTest()} size="small">
              {sendingTest ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
          <p className={`${baseClass}__hint`}>
            Sent through Resend as a single email, filled in as the subscriber selected above, with
            [TEST] before the subject. Its unsubscribe link goes nowhere.
          </p>
        </section>

        <section className={`${baseClass}__panel`}>
          <header className={`${baseClass}__panel-header`}>
            <h3 className={`${baseClass}__panel-title`}>Send</h3>
            {preview && (
              <Pill pillStyle={STATUS_PILL[status].style} size="small">
                {STATUS_PILL[status].label}
              </Pill>
            )}
          </header>

          {preview?.campaign.lastError && status === 'failed' && (
            <Banner type="error">{preview.campaign.lastError}</Banner>
          )}

          {status === 'scheduled' && (
            <>
              <p className={`${baseClass}__hint`}>
                Resend will send it on {formatDate(preview?.campaign.scheduledAt ?? null)}. Cancel
                to edit it again.
              </p>
              <div className={`${baseClass}__panel-actions`}>
                <Button
                  buttonStyle="secondary"
                  disabled={busy}
                  onClick={() => openModal(confirmCancelSlug)}
                  size="small"
                >
                  Cancel scheduled send
                </Button>
                <Button
                  buttonStyle="transparent"
                  disabled={busy}
                  onClick={() => void act('refresh')}
                  size="small"
                >
                  Check status
                </Button>
              </div>
            </>
          )}

          {status === 'sending' && (
            <>
              <p className={`${baseClass}__hint`}>Resend is delivering it to the list’s segment.</p>
              <div className={`${baseClass}__panel-actions`}>
                <Button
                  buttonStyle="transparent"
                  disabled={busy}
                  onClick={() => void act('refresh')}
                  size="small"
                >
                  Check status
                </Button>
              </div>
            </>
          )}

          {status === 'sent' && (
            <p className={`${baseClass}__hint`}>
              Sent {formatDate(preview?.campaign.sentAt ?? null)}. Sent campaigns are read-only —
              duplicate this one to reuse the copy.
            </p>
          )}

          {(status === 'draft' || status === 'failed') && (
            <>
              <div className={`${baseClass}__when`}>
                <Pill
                  onClick={() => setWhen('now')}
                  pillStyle={when === 'now' ? 'dark' : 'light'}
                  size="small"
                >
                  Send now
                </Pill>
                <Pill
                  onClick={() => setWhen('later')}
                  pillStyle={when === 'later' ? 'dark' : 'light'}
                  size="small"
                >
                  Schedule
                </Pill>
              </div>
              {when === 'later' && (
                <div className={`${baseClass}__schedule`}>
                  <DatePicker
                    minDate={new Date()}
                    onChange={(value) => setScheduledAt(value)}
                    pickerAppearance="dayAndTime"
                    placeholder="Pick a date and time"
                    timeIntervals={15}
                    value={scheduledAt ?? undefined}
                  />
                </div>
              )}
              {preview?.privateImages?.length ? (
                <Banner type="error">
                  Readers could not load{' '}
                  {preview.privateImages.length === 1
                    ? 'an image'
                    : `${preview.privateImages.length} images`}{' '}
                  in this campaign ({preview.privateImages.join(', ')}). Sending stays disabled
                  until images are served from a public URL.
                </Banner>
              ) : null}
              {!list?.segmentId && list && (
                <Banner type="info">
                  This list has no Resend segment yet. Resync it from the list first.
                </Banner>
              )}
              <div className={`${baseClass}__panel-actions`}>
                <Button
                  disabled={busy || !canSend}
                  onClick={() => openModal(confirmSendSlug)}
                  size="small"
                >
                  {when === 'later' ? 'Schedule…' : 'Send…'}
                </Button>
              </div>
              <p className={`${baseClass}__hint`}>
                The email is handed to Resend as a broadcast to the segment of “{list?.name ?? '—'}
                ”. Resend fills in each subscriber’s variables and skips everyone who has
                unsubscribed.
              </p>
            </>
          )}
        </section>

        <section className={`${baseClass}__panel`}>
          <h3 className={`${baseClass}__panel-title`}>Variables</h3>
          <p className={`${baseClass}__hint`}>
            Click one to copy it, then paste it into the body on the Edit tab. Add a fallback after
            a bar — {'{{firstName|there}}'} — for people without a value. Each row shows this
            subscriber’s value and what Resend receives.
          </p>
          <VariablesPanel loading={showSkeleton} variables={preview?.variables} />
        </section>
      </div>

      <div className={`${baseClass}__window`}>
        <div className={`${baseClass}__window-wrapper`}>
          <div className={`${baseClass}__toolbar`}>
            <div className={`${baseClass}__toolbar-start`}>
              <Pill
                onClick={() => setMode('html')}
                pillStyle={mode === 'html' ? 'dark' : 'light'}
                size="small"
              >
                HTML
              </Pill>
              <Pill
                onClick={() => setMode('text')}
                pillStyle={mode === 'text' ? 'dark' : 'light'}
                size="small"
              >
                Plain text
              </Pill>
            </div>
            <div className={`${baseClass}__toolbar-center`}>
              <Pill
                onClick={() => setWidth(640)}
                pillStyle={width === 640 ? 'dark' : 'light'}
                size="small"
              >
                Desktop
              </Pill>
              <Pill
                onClick={() => setWidth(375)}
                pillStyle={width === 375 ? 'dark' : 'light'}
                size="small"
              >
                Mobile
              </Pill>
              <span className={`${baseClass}__size`}>{width}px</span>
              {mode === 'html' && (
                <>
                  <span className={`${baseClass}__toolbar-divider`} />
                  <Pill
                    onClick={() => setScheme('light')}
                    pillStyle={scheme === 'light' ? 'dark' : 'light'}
                    size="small"
                  >
                    Light
                  </Pill>
                  <Pill
                    onClick={() => setScheme('dark')}
                    pillStyle={scheme === 'dark' ? 'dark' : 'light'}
                    size="small"
                  >
                    Dark
                  </Pill>
                </>
              )}
            </div>
            <div className={`${baseClass}__toolbar-end`}>
              <Button
                buttonStyle="transparent"
                disabled={loading}
                onClick={() => void load()}
                size="small"
              >
                {loading ? 'Rendering…' : 'Refresh'}
              </Button>
              <Button
                buttonStyle="transparent"
                onClick={() => setIsExpanded((open) => !open)}
                size="small"
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>

          <div className={`${baseClass}__subject`}>
            <span className={`${baseClass}__subject-label`}>
              {preview?.subscriber
                ? `To ${preview.subscriber.name ? `${preview.subscriber.name} <${preview.subscriber.email}>` : preview.subscriber.email}${preview.isSample ? ' (sample)' : ''}`
                : 'Subject'}
            </span>
            {showSkeleton ? (
              <div className={`${baseClass}__subject-skeleton`}>
                <ShimmerEffect height={18} width="70%" />
                <ShimmerEffect animationDelay="80ms" height={12} width="45%" />
              </div>
            ) : (
              <>
                <div className={`${baseClass}__subject-text`}>{preview?.subject}</div>
                {preview?.preheader && (
                  <div className={`${baseClass}__preheader`}>{preview.preheader}</div>
                )}
              </>
            )}
          </div>

          <div className={`${baseClass}__main`}>
            <div className={`${baseClass}__device`} style={{ width: `${width}px` }}>
              {showSkeleton ? (
                <BodySkeleton />
              ) : mode === 'html' ? (
                <iframe
                  className={[
                    `${baseClass}__frame`,
                    scheme === 'dark' && `${baseClass}__frame--dark`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  // Chrome does not re-navigate a sandboxed frame when React only updates srcDoc, so remount it.
                  key={`${renderCount}-${scheme}`}
                  sandbox=""
                  srcDoc={html}
                  title="Campaign preview"
                />
              ) : (
                <pre className={`${baseClass}__text`}>{preview?.text}</pre>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        body={
          when === 'later'
            ? `Resend will send “${preview?.subject ?? ''}” to ${audience ?? 'every subscribed contact'} in “${list?.name ?? ''}” on ${scheduledAt?.toLocaleString() ?? ''}. You can cancel until then.`
            : `Resend starts sending “${preview?.subject ?? ''}” to ${audience ?? 'every subscribed contact'} in “${list?.name ?? ''}” right away. This cannot be undone.`
        }
        confirmingLabel="Sending…"
        confirmLabel={when === 'later' ? 'Schedule' : 'Send now'}
        heading={when === 'later' ? 'Schedule this campaign?' : 'Send this campaign now?'}
        modalSlug={confirmSendSlug}
        onConfirm={async () => {
          await act(
            'send',
            when === 'later' && scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {},
          )
          closeModal(confirmSendSlug)
        }}
      />
      <ConfirmationModal
        body="The broadcast is cancelled and deleted in Resend, and the campaign becomes an editable draft again."
        confirmingLabel="Cancelling…"
        confirmLabel="Cancel send"
        heading="Cancel the scheduled send?"
        modalSlug={confirmCancelSlug}
        onConfirm={async () => {
          await act('cancel')
          closeModal(confirmCancelSlug)
        }}
      />
    </div>
  )
}
