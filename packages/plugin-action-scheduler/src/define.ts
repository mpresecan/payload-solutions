import type { ActionArgs, ActionDefinition, ActionSlug } from './types.js'

import { durationToMs } from './utils/duration.js'

export const SLUG_PATTERN = /^[a-z0-9]+([.\-_][a-z0-9]+)*$/

/** Declares an action. Args are typed from the generated `Config['scheduledActions']` when the slug is known. */
export function defineAction<S extends ActionSlug>(
  definition: ActionDefinition<ActionArgs<S>> & { slug: S },
): ActionDefinition<ActionArgs<S>>
export function defineAction<TArgs extends Record<string, unknown>>(
  definition: ActionDefinition<TArgs>,
): ActionDefinition<TArgs>
export function defineAction(definition: ActionDefinition<any>): ActionDefinition<any> {
  validateDefinition(definition)
  return definition
}

export function validateDefinition(definition: ActionDefinition<any>): void {
  if (!definition || typeof definition !== 'object') {
    throw new Error('defineAction expects an object')
  }
  if (typeof definition.slug !== 'string' || !SLUG_PATTERN.test(definition.slug)) {
    throw new Error(
      `Action slug "${String(definition.slug)}" is invalid: use lowercase letters, digits and single dots, dashes or underscores, e.g. "orders.remind"`,
    )
  }
  if (typeof definition.handler !== 'function') {
    throw new Error(`Action "${definition.slug}" needs a handler function`)
  }
  if (definition.retries !== undefined && (!Number.isInteger(definition.retries) || definition.retries < 0)) {
    throw new Error(`Action "${definition.slug}": retries must be a non-negative integer`)
  }
  if (definition.priority !== undefined && (!Number.isInteger(definition.priority) || definition.priority < 0 || definition.priority > 255)) {
    throw new Error(`Action "${definition.slug}": priority must be an integer from 0 to 255`)
  }
  if (definition.timeout !== undefined) {
    durationToMs(definition.timeout, `timeout of "${definition.slug}"`)
  }
  if (definition.stopAfterFailures !== undefined && definition.stopAfterFailures !== null && (!Number.isInteger(definition.stopAfterFailures) || definition.stopAfterFailures < 1)) {
    throw new Error(`Action "${definition.slug}": stopAfterFailures must be a positive integer or null`)
  }
  if (definition.inputSchema !== undefined && !Array.isArray(definition.inputSchema)) {
    throw new Error(`Action "${definition.slug}": inputSchema must be an array of Payload fields`)
  }
}
