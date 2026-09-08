'use client'
import type { UIFieldClientComponent } from 'payload'

import { useFormFields } from '@payloadcms/ui'
import React from 'react'

const rowStyle: React.CSSProperties = { display: 'flex', fontSize: '12px', gap: '8px', margin: '0 0 4px' }
const keyStyle: React.CSSProperties = { color: 'var(--theme-elevation-500)', minWidth: '64px' }

/** Read-only facts about the email that come from code. */
export const EmailMeta: UIFieldClientComponent = () => {
  const meta = useFormFields(([fields]) => ({
    audience: fields?.audience?.value as string | undefined,
    description: fields?.description?.value as string | undefined,
    group: fields?.group?.value as string | undefined,
    inUse: fields?.inUse?.value as boolean | undefined,
    key: fields?.key?.value as string | undefined,
    required: fields?.required?.value as boolean | undefined,
    trigger: fields?.trigger?.value as string | undefined,
  }))

  return (
    <div className="field-type" style={{ marginBottom: 'var(--base)' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>About this email</div>
      {meta.inUse === false && (
        <p
          style={{
            background: 'var(--theme-warning-100)',
            border: '1px solid var(--theme-warning-400)',
            borderRadius: '3px',
            fontSize: '12px',
            margin: '0 0 8px',
            padding: '6px 8px',
          }}
        >
          Orphaned: this email is no longer defined in code. It will not be sent; you can delete it.
        </p>
      )}
      {meta.description && <p style={{ fontSize: '12px', margin: '0 0 8px' }}>{meta.description}</p>}
      <div style={rowStyle}>
        <span style={keyStyle}>Key</span>
        <code style={{ fontSize: '12px' }}>{meta.key}</code>
      </div>
      {meta.trigger && (
        <div style={rowStyle}>
          <span style={keyStyle}>Sent when</span>
          <span>{meta.trigger}</span>
        </div>
      )}
      {meta.group && (
        <div style={rowStyle}>
          <span style={keyStyle}>Group</span>
          <span>{meta.group}</span>
        </div>
      )}
      <div style={rowStyle}>
        <span style={keyStyle}>Audience</span>
        <span>
          {meta.audience === 'admin' ? 'Administrators' : meta.audience === 'custom' ? 'Custom recipients' : 'The user it concerns'}
        </span>
      </div>
      {meta.required && (
        <div style={rowStyle}>
          <span style={keyStyle}>Required</span>
          <span>Cannot be disabled</span>
        </div>
      )}
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', margin: '8px 0 0' }}>
        These facts are defined in code and refresh on deploy.
      </p>
    </div>
  )
}
