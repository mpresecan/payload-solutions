import type { Payload, PayloadRequest } from 'payload'

import type {
  ActionDefinition,
  ActionHandlerResult,
  FailureReason,
  SanitizedActionSchedulerOptions,
  ScheduledAction,
} from '../types.js'

import { casUpdate } from '../db/cas.js'
import { ActionTimeout, PermanentError, SkipAction } from '../errors.js'
import { nextAttemptAt } from '../utils/backoff.js'
import { durationToMs, formatDuration } from '../utils/duration.js'
import { newToken, truncate } from '../utils/hash.js'
import { nextOccurrence } from '../utils/recurrence.js'
import { dispatch } from './dispatch.js'
import type { LogLine, Store } from './store.js'

/** Grace added to the timeout before a claim counts as lost. */
export const CLAIM_GRACE_MS = 60_000

export type Engine = ReturnType<typeof createEngine>

const isRecurring = (a: Pick<ScheduledAction, 'repeat'>) => a.repeat === 'interval' || a.repeat === 'cron'

function fmtTime(date: Date): string {
  return date.toISOString().slice(11, 16) + ' UTC'
}

export function createEngine(payload: Payload, options: SanitizedActionSchedulerOptions, store: Store) {
  const target = (id: number | string) => ({ collection: options.collectionSlug, id: store.parseId(id) })

  function timeoutFor(definition: ActionDefinition<any> | undefined): number {
    return definition?.timeout !== undefined ? durationToMs(definition.timeout) : options.defaultTimeoutMs
  }

  function redact(error: unknown): { message: string; stack?: string } {
    if (options.redactError) {
      return options.redactError(error)
    }
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack }
    }
    return { message: String(error) }
  }

  /** pending → running with a lease. Returns the claim token, or null when the action is not claimable. */
  async function claim(action: ScheduledAction, definition: ActionDefinition<any> | undefined, attempt: number): Promise<null | string> {
    const now = new Date()
    const token = newToken()
    const ok = await casUpdate(payload, {
      set: {
        attempts: attempt,
        claimedUntil: new Date(now.getTime() + timeoutFor(definition) + CLAIM_GRACE_MS),
        claimToken: token,
        jobId: null,
        lastAttemptAt: now,
        status: 'running',
      },
      target: target(action.id),
      where: [
        { field: 'status', op: '=', value: 'pending' },
        { field: 'scheduleAt', op: '<=', value: new Date(now.getTime() + 1000) },
      ],
    })
    return ok ? token : null
  }

  type Outcome =
    | { durationMs: number; kind: 'failed'; reason: FailureReason; error: unknown }
    | { durationMs: number; kind: 'succeeded'; note?: string; skipped?: boolean }

  /**
   * `action` must be the row as claimed (attempts incremented).
   * Writes the outcome of an attempt guarded by the claim token, appends log lines, and dispatches
   * the next attempt or occurrence. Used by the transport task and by the sweeper (`lost`).
   */
  async function record(
    action: ScheduledAction,
    definition: ActionDefinition<any> | undefined,
    token: string,
    outcome: Outcome,
    handlerLogs: LogLine[],
    req?: PayloadRequest,
  ): Promise<void> {
    const now = new Date()
    const attempt = action.attempts // `action` is the claimed row: attempts already counts this one
    const maxAttempts = action.maxAttempts || options.defaultRetries + 1
    const recurring = isRecurring(action)
    const lines: LogLine[] = [...handlerLogs]
    const set: Record<string, boolean | Date | null | number | string> = {
      claimedUntil: null,
      claimToken: null,
      lastDurationMs: Math.round(outcome.durationMs),
    }
    let next: Date | null = null

    const rearm = (endedFailed: boolean) => {
      set.runCount = (action.runCount ?? 0) + 1
      set.consecutiveFailures = endedFailed ? (action.consecutiveFailures ?? 0) + 1 : 0
      set.attempts = 0
      set.completedAt = now
      const stopAfterFailures = definition?.stopAfterFailures ?? null
      if (action.stopAfterCurrent) {
        set.status = 'canceled'
        lines.push({ event: 'canceled', message: 'Series stopped after this run' })
        return
      }
      if (endedFailed && stopAfterFailures && (set.consecutiveFailures as number) >= stopAfterFailures) {
        set.status = 'failed'
        lines.push({ event: 'failed', level: 'error', message: `Series stopped after ${stopAfterFailures} failed runs in a row` })
        return
      }
      next = nextOccurrence(action, now)
      if (!next) {
        set.status = endedFailed ? 'failed' : 'complete'
        return
      }
      set.status = 'pending'
      set.scheduleAt = next
      set.uniqueKey = action.uniqueKey ?? null
      lines.push({ event: 'rearmed', message: `Next run at ${fmtTime(next)}` })
    }

    if (outcome.kind === 'succeeded') {
      set.lastOutcome = outcome.skipped ? 'skipped' : 'completed'
      set.errorMessage = null
      set.errorStack = null
      set.failureReason = null
      set.note = truncate(outcome.note, 256)
      lines.push({
        attempt,
        durationMs: Math.round(outcome.durationMs),
        event: outcome.skipped ? 'skipped' : 'completed',
        message: outcome.skipped ? `Skipped: ${outcome.note ?? ''}`.trim() : outcome.note ? `Completed · ${outcome.note}` : 'Completed',
      })
      if (recurring) {
        rearm(false)
      } else {
        set.status = 'complete'
        set.completedAt = now
        set.uniqueKey = null
      }
    } else {
      const { message, stack } = redact(outcome.error)
      set.errorMessage = truncate(message, 1000)
      set.errorStack = truncate(stack ?? '', 2000) || null
      set.lastOutcome = outcome.reason === 'timeout' ? 'timeout' : outcome.reason === 'lost' ? 'lost' : 'failed'
      const retryable = outcome.reason === 'error' || outcome.reason === 'timeout' || outcome.reason === 'lost'
      const retryAt = retryable && attempt < maxAttempts ? nextAttemptAt(definition?.backoff ?? options.defaultBackoff, attempt, outcome.error, now) : null
      const what =
        outcome.reason === 'timeout'
          ? `timed out after ${formatDuration(outcome.durationMs)}`
          : outcome.reason === 'lost'
            ? 'worker stopped responding'
            : `failed: ${truncate(message, 160)}`
      if (retryAt) {
        set.status = 'pending'
        set.scheduleAt = retryAt
        next = retryAt
        lines.push({
          attempt,
          durationMs: Math.round(outcome.durationMs),
          event: outcome.reason === 'timeout' ? 'timeout' : outcome.reason === 'lost' ? 'lost' : 'failed',
          level: 'error',
          message: `Attempt ${attempt}/${maxAttempts} ${what} · retry at ${fmtTime(retryAt)}`,
        })
      } else {
        set.failureReason = outcome.reason
        lines.push({
          attempt,
          durationMs: Math.round(outcome.durationMs),
          event: outcome.reason === 'timeout' ? 'timeout' : outcome.reason === 'lost' ? 'lost' : 'failed',
          level: 'error',
          message: `Attempt ${attempt}/${maxAttempts} ${what}${retryable ? ' · no retries left' : ''}`,
        })
        if (recurring) {
          rearm(true)
        } else {
          set.status = 'failed'
          set.completedAt = now
          set.uniqueKey = null
        }
      }
    }

    const ok = await casUpdate(payload, {
      set,
      target: target(action.id),
      where: [
        { field: 'status', op: '=', value: 'running' },
        { field: 'claimToken', op: '=', value: token },
      ],
    })
    if (!ok) {
      payload.logger.warn(
        { actionId: action.id, hook: action.hook },
        '[action-scheduler] late result discarded: the attempt was already recorded (timeout or lost)',
      )
      return
    }
    await store.log(action.id, lines, req)

    if (set.status === 'pending' && next) {
      await dispatch(payload, options, store, { id: action.id, queue: action.queue, scheduleAt: (next as Date).toISOString() }, { req })
    } else if (set.status === 'complete' && definition?.retain === false) {
      await store.remove(action.id, req)
    }
  }

  /** Runs one attempt end to end. Called by the transport task with the job's `req`. */
  async function execute(actionId: string, req: PayloadRequest): Promise<void> {
    const action = await store.get(actionId)
    if (!action) {
      return
    }
    const definition = options.definitions.get(action.hook)
    // Everything derived from the pre-claim row is captured first: adapters may hand back live objects.
    const attempt = (action.attempts ?? 0) + 1
    const claimed: ScheduledAction = { ...action, attempts: attempt, status: 'running' }
    const token = await claim(action, definition, attempt)
    if (!token) {
      return
    }
    const startedAt = Date.now()
    const handlerLogs: LogLine[] = []
    const started: LogLine = {
      attempt,
      event: 'started',
      message: isRecurring(action) ? `Run ${(action.runCount ?? 0) + 1} started` : `Attempt ${attempt}/${action.maxAttempts} started`,
    }
    await store.log(action.id, [started], req)

    if (!definition) {
      await record(claimed, undefined, token, { durationMs: 0, error: new Error(`Action "${action.hook}" is not registered in code`), kind: 'failed', reason: 'handler-missing' }, [], req)
      return
    }

    const controller = new AbortController()
    const timeoutMs = timeoutFor(definition)
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new ActionTimeout(timeoutMs))
      }, timeoutMs)
    })
    const log = (message: string, level: 'error' | 'info' | 'warn' = 'info') => {
      if (handlerLogs.length < 20) {
        handlerLogs.push({ attempt, event: 'note', level, message })
      }
    }

    let outcome: Outcome
    try {
      const result = (await Promise.race([
        Promise.resolve().then(() =>
          definition.handler({
            action: {
              attempt,
              group: action.group,
              hook: action.hook,
              id: action.id,
              maxAttempts: action.maxAttempts,
              recurring: isRecurring(action),
              runCount: action.runCount ?? 0,
              scheduleAt: new Date(action.scheduleAt),
            },
            args: action.args ?? {},
            log,
            payload,
            req,
            signal: controller.signal,
          }),
        ),
        timeout,
      ])) as ActionHandlerResult
      outcome = { durationMs: Date.now() - startedAt, kind: 'succeeded', note: result && typeof result === 'object' ? result.note : undefined }
    } catch (error) {
      const durationMs = Date.now() - startedAt
      if (error instanceof SkipAction) {
        outcome = { durationMs, kind: 'succeeded', note: error.message, skipped: true }
      } else if (error instanceof ActionTimeout) {
        outcome = { durationMs, error, kind: 'failed', reason: 'timeout' }
      } else if (error instanceof PermanentError) {
        outcome = { durationMs, error, kind: 'failed', reason: 'permanent' }
      } else {
        outcome = { durationMs, error, kind: 'failed', reason: 'error' }
      }
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
    await record(claimed, definition, token, outcome, handlerLogs, req)
  }

  return { claim, execute, record, timeoutFor }
}
