import type { Payload } from 'payload'

import { getPluginOptions } from '../index.js'
import { getProcessors, getSubprocessors } from '../processors.js'
import { ProcessorTable, type ProcessorTableProps } from './ProcessorTable.js'

/** Async Server Component that loads the register itself. */
export async function ProcessorTableFromPayload({
  payload,
  locale,
  mode = 'recipients',
  ...props
}: { payload: Payload; locale?: string } & Omit<ProcessorTableProps, 'processors' | 'changes'>) {
  const options = getPluginOptions(payload)
  if (mode === 'changes' || mode === 'subprocessors') {
    const list = await getSubprocessors(payload, options, { locale })
    return <ProcessorTable {...props} changes={list.changes} mode={mode} processors={list.processors} />
  }
  const processors = await getProcessors(payload, options, { locale })
  return <ProcessorTable {...props} mode={mode} processors={processors} />
}
