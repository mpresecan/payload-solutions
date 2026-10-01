export const PLUGIN_NAME = 'plugin-resend-broadcasts'

/** Import-map prefix for admin components. */
export const COMPONENT_PREFIX = '@payload-solutions/plugin-resend-broadcasts'

export const DEFAULT_SLUGS = {
  campaigns: 'newsletter-campaigns',
  lists: 'newsletter-lists',
  settings: 'newsletter-settings',
  syncRuns: 'newsletter-sync-runs',
} as const

/** Base path of the plugin's root endpoints: `/api/resend-broadcasts/*`. */
export const ENDPOINT_BASE = '/resend-broadcasts'

/** Set on `req.context` by the plugin's own writes so the sync hooks do not echo them back to Resend. */
export const SKIP_SYNC = 'resendBroadcastsSkipSync'
/** Set on `req.context` by the plugin when it moves a campaign through its lifecycle. */
export const INTERNAL_WRITE = 'resendBroadcastsInternal'

/** Resend contact-property keys: letters, digits, underscore, max 50. */
export const PROPERTY_KEY_PATTERN = /^\w{1,50}$/

/** Resend property that carries the full name, since contacts only have first/last. */
export const FULL_NAME_PROPERTY = 'full_name'

/** Tokens every campaign can use, whatever the source. */
export const RESERVED_TOKENS = new Set(['email', 'firstName', 'lastName', 'name', 'unsubscribeUrl'])

/** Resend's per-contact unsubscribe placeholder. */
export const RESEND_UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}'
