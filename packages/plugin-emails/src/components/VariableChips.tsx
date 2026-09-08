'use client'
import type { UIFieldClientComponent } from 'payload'

import { toast, useFormFields } from '@payloadcms/ui'
import React from 'react'

import type { VariableManifest } from '../types.js'

const DEFAULT_GLOBALS: VariableManifest = {
  'site.name': { description: 'Site name from email settings' },
  'site.url': { description: 'Site URL from email settings', type: 'url' },
  'support.email': { description: 'Reply-to or from address' },
  year: { description: 'Current year', type: 'number' },
}

const chipStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-100)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: '3px',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  lineHeight: 1.6,
  margin: '0 6px 6px 0',
  padding: '1px 6px',
}

function Chips({ manifest }: { manifest: VariableManifest }) {
  const names = Object.keys(manifest)
  if (!names.length) {
    return <p style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', margin: 0 }}>None</p>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {names.map((name) => {
        const spec = manifest[name] ?? {}
        const title = [spec.description, spec.example !== undefined ? `e.g. ${spec.example}` : null, spec.type ? `(${spec.type})` : null]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={name}
            onClick={async () => {
              const token = `{{${name}}}`
              try {
                await navigator.clipboard.writeText(token)
                toast.success(`Copied ${token}`)
              } catch {
                toast.error('Could not copy to clipboard')
              }
            }}
            style={chipStyle}
            title={title || undefined}
            type="button"
          >
            {`{{${name}}}`}
          </button>
        )
      })}
    </div>
  )
}

/** Sidebar list of the variables this email may use; click copies the token. */
export const VariableChips: UIFieldClientComponent = (props) => {
  const globalManifest = ((props as { globalManifest?: null | VariableManifest }).globalManifest ?? DEFAULT_GLOBALS) as VariableManifest
  const variables = useFormFields(([fields]) => fields?.variables?.value) as null | undefined | VariableManifest

  return (
    <div className="field-type" style={{ marginBottom: 'var(--base)' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Variables</div>
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', margin: '0 0 8px' }}>
        Click to copy, then paste into the subject or body.
      </p>
      <Chips manifest={variables ?? {}} />
      <div style={{ fontSize: '12px', fontWeight: 600, margin: '10px 0 6px' }}>Available everywhere</div>
      <Chips manifest={globalManifest} />
    </div>
  )
}
