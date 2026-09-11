'use client'

import type { TextFieldClientProps } from 'payload'

import { TextField, useFormFields } from '@payloadcms/ui'
import React, { useMemo } from 'react'

import { describeCron } from '../utils/cron-describe.js'
import './styles.scss'

/** The `cron` field: Payload's text input plus a live preview of the expression in words. */
export const CronField: React.FC<TextFieldClientProps> = (props) => {
  const value = useFormFields(([fields]) => fields[props.path]?.value as string | undefined)
  const tz = useFormFields(([fields]) => fields.tz?.value as string | undefined)
  const preview = useMemo(() => {
    if (!value) {
      return null
    }
    const fields = value.trim().split(/\s+/)
    if (fields.length !== 5) {
      return { bad: true, text: 'Five fields: minute hour day-of-month month day-of-week' }
    }
    return { bad: false, text: describeCron(value) }
  }, [value])
  return (
    <div className="pas-cron">
      <TextField {...props} />
      {preview ? (
        <div className="pas-cron__preview" style={preview.bad ? { color: 'var(--theme-error-600)' } : undefined}>
          {preview.bad ? preview.text : <><b>{preview.text}</b>{tz ? ` · ${tz}` : ''}</>}
        </div>
      ) : null}
    </div>
  )
}
