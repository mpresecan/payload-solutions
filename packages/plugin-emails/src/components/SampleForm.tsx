'use client'
import {
  Button,
  CheckboxInput,
  CodeEditorLazy as CodeEditor,
  DatePicker,
  FieldLabel,
  SelectInput,
  TextareaInput,
  TextInput,
} from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import type { SampleFieldSpec } from '../types.js'

import { SampleRelationship } from './SampleRelationship.js'

const baseClass = 'emails-sample-form'

function optionsOf(spec: SampleFieldSpec) {
  return (spec.options ?? []).map((option) => ({ label: option.label, value: option.value }))
}

function firstValue(selected: unknown): string {
  if (Array.isArray(selected)) {
    return String((selected[0] as { value?: unknown } | undefined)?.value ?? '')
  }
  return String((selected as { value?: unknown } | null)?.value ?? '')
}

/**
 * Payload has no standalone number input, and coercing on every keystroke eats a half-typed `1.` or
 * `-`. Keep the raw text locally and hand the parent a number only once it parses.
 */
function NumberControl({
  onChange,
  path,
  spec,
  value,
}: {
  onChange: (value: unknown) => void
  path: string
  spec: SampleFieldSpec
  value: unknown
}) {
  const [draft, setDraft] = useState(value === undefined || value === null ? '' : String(value))

  useEffect(() => {
    const incoming = value === undefined || value === null ? '' : String(value)
    if (incoming !== draft && Number(incoming) !== Number(draft)) {
      setDraft(incoming)
    }
    // Only follow the parent when it changes the value out from under us (e.g. the seeded sample).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <TextInput
      hasMany={false}
      label={spec.label}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (next.trim() === '') {
          onChange('')
        } else if (Number.isFinite(Number(next))) {
          onChange(Number(next))
        }
      }}
      path={path}
      required={spec.required}
      value={draft}
    />
  )
}

function Control({
  onChange,
  path,
  spec,
  value,
}: {
  onChange: (value: unknown) => void
  path: string
  spec: SampleFieldSpec
  value: unknown
}) {
  const shared = { label: spec.label, path, required: spec.required } as const

  switch (spec.type) {
    case 'checkbox':
      return (
        <CheckboxInput
          checked={Boolean(value)}
          id={`field-${path}`}
          label={spec.label}
          name={spec.name}
          onToggle={(event) => onChange(event.target.checked)}
        />
      )

    case 'date': {
      const date = value ? new Date(value as string) : undefined
      return (
        <div className="field-type date-time-field">
          <FieldLabel label={spec.label} path={path} required={spec.required} />
          <div className="field-type__wrap">
            <DatePicker
              onChange={(next) => onChange(next ? new Date(next).toISOString() : '')}
              pickerAppearance="dayAndTime"
              value={date && !Number.isNaN(date.getTime()) ? date : undefined}
            />
          </div>
        </div>
      )
    }

    case 'json':
      return (
        <div className="field-type json-field">
          <FieldLabel label={spec.label} path={path} required={spec.required} />
          <CodeEditor
            defaultLanguage="json"
            maxHeight={240}
            minHeight={90}
            onChange={(next) => onChange(next ?? '')}
            value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
          />
        </div>
      )

    case 'number':
      return <NumberControl onChange={onChange} path={path} spec={spec} value={value} />

    case 'radio':
    case 'select':
      return (
        <SelectInput
          {...shared}
          hasMany={spec.hasMany}
          name={spec.name}
          onChange={(selected) => {
            if (spec.hasMany) {
              const list = Array.isArray(selected) ? selected : selected ? [selected] : []
              onChange(list.map((option) => String((option as { value?: unknown }).value ?? '')))
              return
            }
            onChange(firstValue(selected))
          }}
          options={optionsOf(spec)}
          value={
            spec.hasMany
              ? (Array.isArray(value) ? value : []).map(String)
              : value === undefined || value === null
                ? ''
                : String(value)
          }
        />
      )

    case 'relationship':
      return <SampleRelationship onChange={onChange} path={path} spec={spec} value={value} />

    case 'textarea':
      return (
        <TextareaInput
          {...shared}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          value={String(value ?? '')}
        />
      )

    default:
      return (
        <TextInput
          {...shared}
          hasMany={false}
          onChange={(event) => onChange(event.target.value)}
          value={String(value ?? '')}
        />
      )
  }
}

function SampleField({
  onChange,
  path,
  spec,
  value,
}: {
  onChange: (value: unknown) => void
  path: string
  spec: SampleFieldSpec
  value: unknown
}) {
  if (spec.type === 'group' && spec.fields?.length) {
    return (
      <div className={`${baseClass}__nested`}>
        <FieldLabel label={spec.label} path={path} />
        <SampleForm
          fields={spec.fields}
          onChange={(next) => onChange(next)}
          path={path}
          value={(value ?? {}) as Record<string, unknown>}
        />
      </div>
    )
  }

  if (spec.type === 'array' && spec.fields?.length) {
    const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
    return (
      <div className={`${baseClass}__array`}>
        <FieldLabel label={spec.label} path={path} />
        {rows.map((row, index) => (
          <div className={`${baseClass}__nested`} key={index}>
            <SampleForm
              fields={spec.fields!}
              onChange={(next) => {
                const updated = [...rows]
                updated[index] = next
                onChange(updated)
              }}
              path={`${path}.${index}`}
              value={row}
            />
            <Button
              buttonStyle="secondary"
              onClick={() => onChange(rows.filter((_, other) => other !== index))}
              size="xsmall"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button buttonStyle="secondary" onClick={() => onChange([...rows, {}])} size="small">
          Add row
        </Button>
      </div>
    )
  }

  return (
    <div className={`${baseClass}__field`}>
      <Control onChange={onChange} path={path} spec={spec} value={value} />
      {spec.description && <p className={`${baseClass}__description`}>{spec.description}</p>}
    </div>
  )
}

/** A form built from the email's `inputSchema` out of Payload's own field inputs. */
export const SampleForm: React.FC<{
  fields: SampleFieldSpec[]
  onChange: (value: Record<string, unknown>) => void
  path?: string
  value: Record<string, unknown>
}> = ({ fields, onChange, path = 'sample', value }) => (
  <div className={baseClass}>
    {fields.map((spec) => (
      <SampleField
        key={spec.name}
        onChange={(next) => onChange({ ...value, [spec.name]: next })}
        path={`${path}.${spec.name}`}
        spec={spec}
        value={value[spec.name]}
      />
    ))}
  </div>
)
