import type { Payload, PayloadRequest } from 'payload'

import type { SanitizedActionSchedulerOptions, ScheduledAction } from '../types.js'

import { RUN_TASK_SLUG } from '../types.js'
import type { Store } from './store.js'

/**
 * Queues the transport job for an action. The job carries only `{ actionId }`; `waitUntil` mirrors
 * `scheduleAt`. Only actions due within the dispatch horizon get a job at schedule time; the tick
 * promotes the rest (§9.2).
 */
export async function dispatch(
  payload: Payload,
  options: SanitizedActionSchedulerOptions,
  store: Store,
  action: Pick<ScheduledAction, 'id' | 'queue' | 'scheduleAt'>,
  args: { force?: boolean; req?: PayloadRequest } = {},
): Promise<null | string> {
  const scheduleAt = new Date(action.scheduleAt)
  const now = Date.now()
  if (!args.force && scheduleAt.getTime() - now > options.dispatchHorizonMs) {
    return null
  }
  const job = await payload.jobs.queue({
    input: { actionId: String(action.id) },
    queue: action.queue || 'default',
    req: args.req,
    task: RUN_TASK_SLUG as never,
    waitUntil: scheduleAt.getTime() > now ? scheduleAt : undefined,
  } as never)
  const jobId = String((job as { id: number | string }).id)
  await store.update(action.id, { jobId }, args.req)
  return jobId
}

export function withinHorizon(options: SanitizedActionSchedulerOptions, scheduleAt: Date | string): boolean {
  return new Date(scheduleAt).getTime() - Date.now() <= options.dispatchHorizonMs
}
