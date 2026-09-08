'use client'
import {
  Banner,
  Button,
  CodeEditorLazy as CodeEditor,
  Pill,
  SelectInput,
  ShimmerEffect,
  TextInput,
  toast,
} from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ColorScheme } from '../render/color-scheme.js'
import type { SampleFieldSpec, VariableManifest } from '../types.js'

import { forceColorScheme } from '../render/color-scheme.js'
import { SampleForm } from './SampleForm.js'
import { VariablesPanel } from './VariablesPanel.js'
import './preview.css'

type Props = {
  apiRoute: string
  collectionSlug: string
  defaultLocale?: string
  hasDrafts: boolean
  id: string
  inUse: boolean
  locales: Array<{ code: string; label: string }>
  sampleFields: SampleFieldSpec[]
  sampleInput: null | Record<string, unknown>
  serverURL: string
  testRecipient: string
}

type PreviewResponse = {
  html: string
  input: Record<string, unknown>
  manifest?: { email?: VariableManifest; global?: VariableManifest }
  message?: string
  preheader?: string
  subject: string
  text: string
  to: string[]
  variables: Record<string, unknown>
  warning?: string
}

const baseClass = 'emails-preview'


/** Skeleton shown while a render is in flight, so the subject and body do not sit blank. */
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

export const PreviewClient: React.FC<Props> = ({
  id,
  apiRoute,
  collectionSlug,
  defaultLocale,
  hasDrafts,
  inUse,
  locales,
  sampleFields,
  sampleInput,
  serverURL,
  testRecipient,
}) => {
  const [locale, setLocale] = useState(defaultLocale ?? '')
  const [draft, setDraft] = useState(true)
  const [mode, setMode] = useState<'html' | 'text'>('html')
  const [width, setWidth] = useState<375 | 640>(640)
  const [editor, setEditor] = useState<'form' | 'json'>(sampleFields.length ? 'form' : 'json')
  const [values, setValues] = useState<Record<string, unknown>>(sampleInput ?? {})
  const [json, setJson] = useState(sampleInput ? JSON.stringify(sampleInput, null, 2) : '')
  const [jsonError, setJsonError] = useState<null | string>(null)
  const [preview, setPreview] = useState<null | PreviewResponse>(null)
  // Chrome does not re-navigate a sandboxed frame when React only updates srcDoc, so remount it.
  const [renderCount, setRenderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSkeleton, setShowSkeleton] = useState(true)
  const [to, setTo] = useState(testRecipient)
  const [sending, setSending] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [scheme, setScheme] = useState<ColorScheme>('light')
  const seeded = useRef(false)

  const base = useMemo(() => `${serverURL}${apiRoute}/${collectionSlug}/${id}`, [apiRoute, collectionSlug, id, serverURL])

  const html = useMemo(() => forceColorScheme(preview?.html ?? '', scheme), [preview?.html, scheme])

  const currentInput = useCallback((): null | Record<string, unknown> | undefined => {
    if (editor === 'json') {
      if (!json.trim()) {
        setJsonError(null)
        return undefined
      }
      try {
        const parsed = JSON.parse(json) as Record<string, unknown>
        setJsonError(null)
        return parsed
      } catch (e) {
        setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
        return null
      }
    }
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    )
    return Object.keys(cleaned).length ? cleaned : undefined
  }, [editor, json, values])

  const load = useCallback(async () => {
    const parsed = currentInput()
    if (parsed === null) {
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${base}/preview`, {
        body: JSON.stringify({ draft, input: parsed, locale: locale || undefined }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await res.json()) as PreviewResponse
      if (!res.ok) {
        toast.error(data.message ?? 'Preview failed')
        return
      }
      setPreview(data)
      setRenderCount((n) => n + 1)
      // First render: adopt whatever the server fell back to, so the form starts filled in.
      if (!seeded.current && data.input && Object.keys(data.input).length) {
        seeded.current = true
        setValues(data.input)
        setJson(JSON.stringify(data.input, null, 2))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
     
  }, [base, draft, locale, currentInput])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, locale])

  // Re-render shortly after the sample data settles, so editing the form updates the preview.
  useEffect(() => {
    if (!seeded.current) {
      return
    }
    const timer = setTimeout(() => void load(), 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, json, editor])

  // Skeleton immediately on the first render; on later ones only if it is slow enough to notice,
  // so typing in the sample form does not strobe the panel.
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

  const sendTest = async () => {
    const parsed = currentInput()
    if (parsed === null) {
      return
    }
    setSending(true)
    try {
      const res = await fetch(`${base}/send-test`, {
        body: JSON.stringify({ draft, input: parsed, locale: locale || undefined, to }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await res.json()) as { error?: string; message?: string; status?: string }
      if (res.ok && data.status === 'sent') {
        toast.success(`Test email sent to ${to}`)
      } else {
        toast.error(data.message ?? data.error ?? `Send failed (${data.status ?? res.status})`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const switchEditor = (next: 'form' | 'json') => {
    if (next === 'json') {
      setJson(JSON.stringify(values, null, 2))
    } else {
      try {
        setValues(json.trim() ? (JSON.parse(json) as Record<string, unknown>) : {})
        setJsonError(null)
      } catch {
        // keep the current form values if the JSON is not parseable
      }
    }
    setEditor(next)
  }

  if (!inUse) {
    return (
      <div className={`${baseClass}__notice`}>
        <Banner type="error">This email is no longer defined in code, so it cannot be previewed or sent.</Banner>
      </div>
    )
  }

  return (
    <div className={[baseClass, isExpanded && `${baseClass}--is-expanded`].filter(Boolean).join(' ')}>
      <div className={`${baseClass}__fields`}>
        <section className={`${baseClass}__panel`}>
          <header className={`${baseClass}__panel-header`}>
            <h3 className={`${baseClass}__panel-title`}>Sample data</h3>
            {sampleFields.length > 0 && (
              <Button
                buttonStyle="none"
                className={`${baseClass}__link-button`}
                onClick={() => switchEditor(editor === 'form' ? 'json' : 'form')}
                size="xsmall"
              >
                {editor === 'form' ? 'Edit as JSON' : 'Back to form'}
              </Button>
            )}
          </header>
          <p className={`${baseClass}__hint`}>Stand-in values for this preview. Nothing here is saved with the email.</p>

          {editor === 'form' && sampleFields.length > 0 ? (
            <SampleForm fields={sampleFields} onChange={setValues} value={values} />
          ) : (
            <div className="field-type json-field">
              <CodeEditor
                defaultLanguage="json"
                maxHeight={320}
                minHeight={140}
                onChange={(next) => setJson(next ?? '')}
                value={json}
              />
              {jsonError && <p className={`${baseClass}__error`}>{jsonError}</p>}
            </div>
          )}

          <div className={`${baseClass}__controls`}>
            {locales.length > 0 && (
              <SelectInput
                isClearable={false}
                label="Locale"
                name="preview-locale"
                onChange={(option) => setLocale(String((option as { value?: unknown })?.value ?? ''))}
                options={locales.map((l) => ({ label: l.label, value: l.code }))}
                path="preview-locale"
                value={locale}
              />
            )}
            {hasDrafts && (
              <SelectInput
                isClearable={false}
                label="Version"
                name="preview-version"
                onChange={(option) => setDraft(String((option as { value?: unknown })?.value ?? '') === 'draft')}
                options={[
                  { label: 'Latest draft', value: 'draft' },
                  { label: 'Published', value: 'published' },
                ]}
                path="preview-version"
                value={draft ? 'draft' : 'published'}
              />
            )}
          </div>
        </section>

        <section className={`${baseClass}__panel`}>
          <h3 className={`${baseClass}__panel-title`}>Send a test</h3>
          <TextInput
            hasMany={false}
            label="Recipient"
            onChange={(event) => setTo(event.target.value)}
            path="preview-test-recipient"
            placeholder="you@example.com"
            value={to}
          />
          <div className={`${baseClass}__panel-actions`}>
            <Button disabled={sending || !to} onClick={() => void sendTest()} size="small">
              {sending ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
          <p className={`${baseClass}__hint`}>Uses the copy selected above; the subject is prefixed with [TEST].</p>
        </section>

        <section className={`${baseClass}__panel`}>
          <h3 className={`${baseClass}__panel-title`}>Recipients</h3>
          <p className={`${baseClass}__hint`}>
            Where this email would go if it were sent with the sample data above. A test send ignores this and
            uses the address under Send a test.
          </p>
          {showSkeleton ? (
            <ShimmerEffect height={24} width="60%" />
          ) : preview?.to?.length ? (
            <div className={`${baseClass}__recipients`}>
              {preview.to.map((address) => (
                <Pill key={address} pillStyle="light-gray" size="small">
                  {address}
                </Pill>
              ))}
            </div>
          ) : (
            <p className={`${baseClass}__hint`}>None resolved for this sample.</p>
          )}
        </section>

        <section className={`${baseClass}__panel`}>
          <h3 className={`${baseClass}__panel-title`}>Variables</h3>
          <p className={`${baseClass}__hint`}>
            Placeholders you can paste into the subject or body on the Edit tab — click one to copy it. The values
            beside them are what this preview resolved; the ones available everywhere come from Email Settings.
          </p>
          <VariablesPanel
            emailManifest={preview?.manifest?.email}
            globalManifest={preview?.manifest?.global}
            loading={showSkeleton}
            variables={showSkeleton ? undefined : preview?.variables}
          />
        </section>
      </div>

      <div className={`${baseClass}__window`}>
        <div className={`${baseClass}__window-wrapper`}>
          <div className={`${baseClass}__toolbar`}>
            <div className={`${baseClass}__toolbar-start`}>
              <Pill onClick={() => setMode('html')} pillStyle={mode === 'html' ? 'dark' : 'light'} size="small">
                HTML
              </Pill>
              <Pill onClick={() => setMode('text')} pillStyle={mode === 'text' ? 'dark' : 'light'} size="small">
                Plain text
              </Pill>
            </div>
            <div className={`${baseClass}__toolbar-center`}>
              <Pill onClick={() => setWidth(640)} pillStyle={width === 640 ? 'dark' : 'light'} size="small">
                Desktop
              </Pill>
              <Pill onClick={() => setWidth(375)} pillStyle={width === 375 ? 'dark' : 'light'} size="small">
                Mobile
              </Pill>
              <span className={`${baseClass}__size`}>{width}px</span>
              {mode === 'html' && (
                <>
                  <span className={`${baseClass}__toolbar-divider`} />
                  <Pill
                    aria-label="Preview as a light-mode mail client"
                    onClick={() => setScheme('light')}
                    pillStyle={scheme === 'light' ? 'dark' : 'light'}
                    size="small"
                  >
                    Light
                  </Pill>
                  <Pill
                    aria-label="Preview as a dark-mode mail client"
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
              <Button buttonStyle="transparent" disabled={loading} onClick={() => void load()} size="small">
                {loading ? 'Rendering…' : 'Refresh'}
              </Button>
              <Button buttonStyle="transparent" onClick={() => setIsExpanded((open) => !open)} size="small">
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>

          {preview?.warning && !showSkeleton && (
            <div className={`${baseClass}__notice`}>
              <Banner type="info">{preview.warning}</Banner>
            </div>
          )}

          <div className={`${baseClass}__subject`}>
            <span className={`${baseClass}__subject-label`}>Subject</span>
            {showSkeleton ? (
              <div className={`${baseClass}__subject-skeleton`}>
                <ShimmerEffect height={18} width="70%" />
                <ShimmerEffect animationDelay="80ms" height={12} width="45%" />
              </div>
            ) : (
              <>
                <div className={`${baseClass}__subject-text`}>{preview?.subject}</div>
                {preview?.preheader && <div className={`${baseClass}__preheader`}>{preview.preheader}</div>}
              </>
            )}
          </div>

          <div className={`${baseClass}__main`}>
            <div className={`${baseClass}__device`} style={{ width: `${width}px` }}>
              {showSkeleton ? (
                <BodySkeleton />
              ) : mode === 'html' ? (
                <iframe
                  className={[`${baseClass}__frame`, scheme === 'dark' && `${baseClass}__frame--dark`]
                    .filter(Boolean)
                    .join(' ')}
                  key={`${renderCount}-${scheme}`}
                  sandbox=""
                  srcDoc={html}
                  title="Email preview"
                />
              ) : (
                <pre className={`${baseClass}__text`}>{preview?.text}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
