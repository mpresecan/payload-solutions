import type { Payload } from 'payload'

import type { VercelAPI } from './types.js'

export { classifyChange, resolveTitle, summarize } from './changes/summary.js'
export { changeKey } from './collections/changes.js'
export { cancel, rollback, rollbackCandidates } from './deploy/actions.js'
export { matchDeployment } from './deploy/match.js'
export { isDue, nextWindow, rollingHour, windowDedupeKey } from './deploy/schedule.js'
export { canTransition, patchFromVercel, stateFromVercel } from './deploy/state.js'
export { applyRetention, tick } from './deploy/tick.js'
export { HourlyLimitError, TargetNotConfiguredError, trigger, triggerWithOutcome } from './deploy/trigger.js'
export { COMPONENT_PREFIX, DEFAULT_VIEW_PATH, ENDPOINT_BASE, PLUGIN_SLUG } from './constants.js'
export { parseHookUrl, sanitizeOptions, TICK_TASK_SLUG } from './options.js'
export { vercelPlugin } from './plugin.js'
export type * from './types.js'
export { formatDuration, parseDuration } from './utils/duration.js'
export { signVercelPayload, verifyVercelSignature } from './utils/hmac.js'
export { VercelApiError, VercelClient } from './vercel/client.js'
export type * from './vercel/types.js'

export function getVercelAPI(payload: Payload): VercelAPI {
  if (!payload.vercel) {
    throw new Error('[plugin-vercel] payload.vercel is not available. Is vercelPlugin() in your config and has Payload initialised?')
  }
  return payload.vercel
}

declare module 'payload' {
  // Merged into the exported BasePayload class; attached by the plugin in onInit.
  interface BasePayload {
    vercel: VercelAPI
  }
}
