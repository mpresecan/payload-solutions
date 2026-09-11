import type { Payload } from 'payload'

import type { ActionArgs, ActionSlug, CronOptions, Match, RecurringOptions, ScheduleOptions } from './types.js'

/** Function-style API for code that only has a `Payload` value without the `BasePayload` augmentation. */
export const scheduleAction = <S extends ActionSlug>(payload: Payload, hook: S, args: ActionArgs<S>, opts?: ScheduleOptions) =>
  payload.scheduler.schedule(hook, args, opts)
export const enqueueAction = <S extends ActionSlug>(payload: Payload, hook: S, args: ActionArgs<S>, opts?: Omit<ScheduleOptions, 'scheduleAt'>) =>
  payload.scheduler.enqueue(hook, args, opts)
export const scheduleRecurringAction = <S extends ActionSlug>(payload: Payload, hook: S, args: ActionArgs<S>, opts: RecurringOptions) =>
  payload.scheduler.recurring(hook, args, opts)
export const scheduleCronAction = <S extends ActionSlug>(payload: Payload, hook: S, args: ActionArgs<S>, opts: CronOptions) =>
  payload.scheduler.cron(hook, args, opts)
export const unscheduleAction = <S extends ActionSlug>(payload: Payload, hook: S, match?: Match<S>) => payload.scheduler.cancel(hook, match)
export const unscheduleAllActions = <S extends ActionSlug>(payload: Payload, hook: S, match?: Match<S>) => payload.scheduler.cancelAll(hook, match)
export const nextScheduledAction = <S extends ActionSlug>(payload: Payload, hook: S, match?: Match<S>) => payload.scheduler.next(hook, match)
export const hasScheduledAction = <S extends ActionSlug>(payload: Payload, hook: S, match?: Match<S>) => payload.scheduler.has(hook, match)
