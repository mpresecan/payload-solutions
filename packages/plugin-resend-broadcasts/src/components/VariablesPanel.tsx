'use client'
import { Pill, ShimmerEffect, toast } from '@payloadcms/ui'
import React from 'react'

import type { VariableInfo } from '../types.js'

type Row = { used: boolean; value: string } & VariableInfo

const GROUPS: Array<{ title: string; type: VariableInfo['type'] }> = [
  { type: 'subscriber', title: 'This subscriber' },
  { type: 'property', title: 'Contact properties' },
  { type: 'global', title: 'Same for everyone' },
]

/** Every token a campaign can use, this subscriber's value for it, and what Resend receives. */
export const VariablesPanel: React.FC<{ loading: boolean; variables?: Row[] }> = ({
  loading,
  variables,
}) => {
  if (loading || !variables) {
    return (
      <div className="newsletter-variables">
        <ShimmerEffect height={14} width="80%" />
        <ShimmerEffect animationDelay="60ms" height={14} width="65%" />
        <ShimmerEffect animationDelay="120ms" height={14} width="72%" />
      </div>
    )
  }

  const copy = async (token: string) => {
    const text = `{{${token}}}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied ${text}`)
    } catch {
      toast.error('Could not copy to the clipboard')
    }
  }

  return (
    <div className="newsletter-variables">
      {GROUPS.map(({ type, title }) => {
        const rows = variables.filter((v) => v.type === type)
        if (!rows.length) {
          return null
        }
        return (
          <div className="newsletter-variables__group" key={type}>
            <p className="newsletter-variables__group-title">{title}</p>
            {rows.map((row) => (
              <div className="newsletter-variables__row" key={row.token} title={row.description}>
                <button
                  className="newsletter-variables__token"
                  onClick={() => void copy(row.token)}
                  type="button"
                >
                  {`{{${row.token}}}`}
                </button>
                <span
                  className={[
                    'newsletter-variables__value',
                    !row.value && 'newsletter-variables__value--empty',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {row.value || 'empty'}
                  {row.used && (
                    <>
                      {' '}
                      <Pill pillStyle="light-gray" size="small">
                        used
                      </Pill>
                    </>
                  )}
                </span>
                {type !== 'global' && (
                  <p className="newsletter-variables__resend">Resend: {row.resend}</p>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
