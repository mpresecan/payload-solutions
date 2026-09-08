'use client'
import type { ValueWithRelation } from 'payload'

import { Button, RelationshipInput, useDocumentDrawer } from '@payloadcms/ui'
import React, { useMemo } from 'react'

import type { SampleFieldSpec } from '../types.js'

/**
 * Sample input stores what `resolve()` receives: a bare id when the field points at one collection,
 * Payload's `{ relationTo, value }` shape when it is polymorphic.
 */
function toInputValue(relationTo: string[], value: null | ValueWithRelation): unknown {
  if (!value || value.value === undefined || value.value === null || value.value === '') {
    return ''
  }
  return relationTo.length > 1 ? { relationTo: value.relationTo, value: value.value } : value.value
}

function toRelationValue(relationTo: string[], raw: unknown): null | ValueWithRelation {
  if (raw === undefined || raw === null || raw === '') {
    return null
  }
  if (typeof raw === 'object') {
    const { relationTo: to, value } = raw as Partial<ValueWithRelation>
    return value === undefined || value === null
      ? null
      : { relationTo: typeof to === 'string' ? to : relationTo[0], value }
  }
  return { relationTo: relationTo[0], value: raw as number | string }
}

const baseClass = 'emails-sample-relationship'

/**
 * Payload's own relationship input (documents show their title, search and pagination included) plus
 * a Preview button that opens the selected document in a side drawer without leaving the tab.
 */
export const SampleRelationship: React.FC<{
  onChange: (value: unknown) => void
  path: string
  spec: SampleFieldSpec
  value: unknown
}> = ({ onChange, path, spec, value }) => {
  const relationTo = useMemo(() => spec.relationTo ?? [], [spec.relationTo])
  const hasMany = spec.hasMany === true

  const single = hasMany ? null : toRelationValue(relationTo, value)
  const many = useMemo(() => {
    if (!hasMany) {
      return []
    }
    const list = Array.isArray(value) ? value : []
    return list.map((entry) => toRelationValue(relationTo, entry)).filter(Boolean) as ValueWithRelation[]
  }, [hasMany, relationTo, value])

  const [DocumentDrawer, , { openDrawer }] = useDocumentDrawer({
    id: single?.value,
    collectionSlug: single?.relationTo ?? relationTo[0],
  })

  if (!relationTo.length) {
    return null
  }

  const shared = {
    allowCreate: false,
    allowEdit: true,
    className: `${baseClass}__input`,
    label: spec.label,
    path,
    relationTo,
    required: spec.required,
  } as const

  return (
    <div className={baseClass}>
      {hasMany ? (
        <RelationshipInput
          {...shared}
          hasMany
          onChange={(next) => onChange((next ?? []).map((entry) => toInputValue(relationTo, entry)))}
          value={many}
        />
      ) : (
        <RelationshipInput
          {...shared}
          hasMany={false}
          onChange={(next) => onChange(toInputValue(relationTo, next))}
          value={single}
        />
      )}
      {!hasMany && (
        <div className={`${baseClass}__actions`}>
          <Button
            buttonStyle="secondary"
            disabled={!single}
            onClick={() => openDrawer()}
            size="xsmall"
          >
            Preview
          </Button>
          {single && <DocumentDrawer />}
        </div>
      )}
    </div>
  )
}
