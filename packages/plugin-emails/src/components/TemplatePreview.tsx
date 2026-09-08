'use client'
import type { UIFieldClientComponent } from 'payload'

import { Button, Pill, SelectInput, useConfig, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type { ColorScheme } from '../render/color-scheme.js'

import { forceColorScheme } from '../render/color-scheme.js'
import './preview.css'

const panel: React.CSSProperties = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '4px',
  padding: '16px',
}

/**
 * Read-only look at the template every email is rendered in, plus the note that changing it is a
 * developer job. Refreshes after a save so footer edits show up.
 */
export const TemplatePreview: UIFieldClientComponent = () => {
  const { config } = useConfig()
  const { savedDocumentData } = useDocumentInfo()
  const [html, setHtml] = useState('')
  const [templates, setTemplates] = useState<string[]>([])
  const [active, setActive] = useState('default')
  const [loading, setLoading] = useState(false)
  const [renderCount, setRenderCount] = useState(0)
  const [error, setError] = useState<null | string>(null)
  const [scheme, setScheme] = useState<ColorScheme>('light')

  const framed = useMemo(() => forceColorScheme(html, scheme), [html, scheme])

  const load = useCallback(
    async (template: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${config.serverURL}${config.routes.api}/email-templates/preview`, {
          body: JSON.stringify({ template }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        const data = (await res.json()) as { html?: string; message?: string; templates?: string[] }
        if (!res.ok || !data.html) {
          setError(data.message ?? 'Could not render the template.')
          return
        }
        setHtml(data.html)
        setTemplates(data.templates ?? [])
        setRenderCount((n) => n + 1)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not render the template.')
      } finally {
        setLoading(false)
      }
    },
    [config.routes.api, config.serverURL],
  )

  useEffect(() => {
    void load(active)
    // Re-render after a save so a footer change is reflected.
  }, [active, load, savedDocumentData])

  return (
    <div className="field-type">
      <div style={{ ...panel, marginBottom: '12px' }}>
        <p style={{ fontSize: '13px', margin: '0 0 8px' }}>
          <strong>The design of your emails is set by a template in your project’s code.</strong> Colours, spacing,
          the logo and the overall layout live there so every email stays consistent.
        </p>
        <p style={{ color: 'var(--theme-elevation-600)', fontSize: '13px', margin: 0 }}>
          You can edit the wording of each email under <strong>Transactional Emails</strong>, and the footer on the
          Content tab. To change the template itself, contact your developers.
        </p>
      </div>

      <div className="emails-template-preview__controls">
        {templates.length > 1 && (
          <SelectInput
            isClearable={false}
            label="Template"
            name="template-preview"
            onChange={(option) => setActive(String((option as { value?: unknown })?.value ?? ''))}
            options={templates.map((t) => ({ label: t, value: t }))}
            path="template-preview"
            value={active}
          />
        )}
        <Pill onClick={() => setScheme('light')} pillStyle={scheme === 'light' ? 'dark' : 'light'} size="small">
          Light
        </Pill>
        <Pill onClick={() => setScheme('dark')} pillStyle={scheme === 'dark' ? 'dark' : 'light'} size="small">
          Dark
        </Pill>
        <Button buttonStyle="secondary" disabled={loading} onClick={() => void load(active)} size="small">
          {loading ? 'Rendering…' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <p style={{ color: 'var(--theme-error-500)', fontSize: '13px' }}>{error}</p>
      ) : (
        <iframe
          key={`${renderCount}-${scheme}`}
          sandbox=""
          srcDoc={framed || '<p style="font-family:sans-serif;padding:24px">Rendering…</p>'}
          style={{
            background: scheme === 'dark' ? '#09090b' : '#fff',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: '4px',
            height: '620px',
            maxWidth: '100%',
            width: '640px',
          }}
          title="Template preview"
        />
      )}
    </div>
  )
}
