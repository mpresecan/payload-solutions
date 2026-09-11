'use client'
import type { DefaultCellComponentProps } from 'payload'

import { Pill } from '@payloadcms/ui'
import React from 'react'

import { formatDuration } from '../utils/duration.js'
import { stateLabel, statePillStyle } from './status.js'

/** `state` column of the deployments list. */
export const StateCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const state = typeof cellData === 'string' ? cellData : 'unknown'
  return (
    <Pill pillStyle={statePillStyle(state)} size="small">
      {stateLabel(state)}
    </Pill>
  )
}

/** `durationMs` column of the deployments list. */
export const DurationCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  if (typeof cellData !== 'number') {
    return <span>—</span>
  }
  return <span>{formatDuration(cellData)}</span>
}
