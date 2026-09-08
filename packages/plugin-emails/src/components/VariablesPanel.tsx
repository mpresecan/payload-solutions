'use client'
import { CopyToClipboard, Pill, ShimmerEffect } from '@payloadcms/ui'
import React from 'react'

import type { VariableManifest, VariableSpec } from '../types.js'

const baseClass = 'emails-variables'

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === null || value === undefined) {
    return ''
  }
  return JSON.stringify(value)
}

function Row({ name, spec, value }: { name: string; spec: VariableSpec; value: unknown }) {
  const resolved = formatValue(value)
  const hasValue = resolved !== ''

  return (
    <div className={`${baseClass}__row`}>
      <div className={`${baseClass}__token`}>
        <code>{`{{${name}}}`}</code>
        <CopyToClipboard defaultMessage="Copy token" successMessage="Copied" value={`{{${name}}}`} />
      </div>
      {hasValue ? (
        <div className={`${baseClass}__value`} title={resolved}>
          {resolved}
        </div>
      ) : (
        <div className={`${baseClass}__value ${baseClass}__value--empty`}>
          <Pill pillStyle="warning" size="small">
            not resolved
          </Pill>
        </div>
      )}
      {spec.description && <p className={`${baseClass}__description`}>{spec.description}</p>}
    </div>
  )
}

function Group({
  manifest,
  title,
  variables,
}: {
  manifest: VariableManifest
  title: string
  variables: Record<string, unknown>
}) {
  const names = Object.keys(manifest)

  return (
    <div className={`${baseClass}__group`}>
      <h4 className={`${baseClass}__group-title`}>{title}</h4>
      {names.length ? (
        names.map((name) => <Row key={name} name={name} spec={manifest[name] ?? {}} value={variables[name]} />)
      ) : (
        <p className={`${baseClass}__empty`}>None</p>
      )}
    </div>
  )
}

/**
 * Every variable the copy may use — the email's own and the ones available everywhere — next to the
 * value it resolved to for the render on screen.
 */
export const VariablesPanel: React.FC<{
  emailManifest?: VariableManifest
  globalManifest?: VariableManifest
  loading?: boolean
  variables?: Record<string, unknown>
}> = ({ emailManifest, globalManifest, loading, variables }) => {
  if (loading && !variables) {
    return (
      <div className={baseClass}>
        {[0, 1, 2].map((index) => (
          <ShimmerEffect animationDelay={`${index * 60}ms`} height={28} key={index} />
        ))}
      </div>
    )
  }

  const resolved = variables ?? {}
  const known = new Set([...Object.keys(emailManifest ?? {}), ...Object.keys(globalManifest ?? {})])
  const extras = Object.keys(resolved).filter((name) => !known.has(name))

  return (
    <div className={baseClass}>
      <Group manifest={emailManifest ?? {}} title="This email" variables={resolved} />
      <Group manifest={globalManifest ?? {}} title="Available everywhere" variables={resolved} />
      {extras.length > 0 && (
        <Group
          manifest={Object.fromEntries(extras.map((name) => [name, {}]))}
          title="Also resolved"
          variables={resolved}
        />
      )}
    </div>
  )
}
