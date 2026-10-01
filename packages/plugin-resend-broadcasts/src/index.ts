import type { Payload } from 'payload'

import type { ResendBroadcastsAPI } from './types.js'

export { LOCKED_STATUSES } from './campaigns.js'
export { DEFAULT_SLUGS, ENDPOINT_BASE, RESEND_UNSUBSCRIBE_PLACEHOLDER } from './constants.js'
export { ButtonBlock, tokenAwareUrlHook } from './editor/button-block.js'
export { createEmailEditor, emailEditorFeatures } from './editor/features.js'
export type { EmailEditorOptions } from './editor/features.js'
export { createImageBlock, IMAGE_BLOCK_SLUG, IMAGE_WIDTHS } from './editor/image-block.js'
export { absoluteUrl, findPrivateImages, isPublicImageUrl } from './render/images.js'
export { sanitizeOptions } from './options.js'
export { resendBroadcastsPlugin } from './plugin.js'
export { extractTokens, interpolate } from './render/interpolate.js'
export { interpolateToNodes, lexicalToReact } from './render/lexical-react.js'
export { markdownToLexical } from './render/markdown.js'
export { createResolver, renderCampaign, variableCatalog } from './render/render.js'
export { darkModeCSS, defaultStyles, DefaultTemplate, EMAIL_CLASS } from './render/template.js'
export { createResendClient, isNotFound, ResendApiError } from './resend/client.js'
export type { ResendClient } from './resend/client.js'
export { toSubscriber } from './sources/subscriber.js'
export type * from './types.js'

export function getResendBroadcasts(payload: Payload): ResendBroadcastsAPI {
  if (!payload.resendBroadcasts) {
    throw new Error(
      '[plugin-resend-broadcasts] payload.resendBroadcasts is not available. Is resendBroadcastsPlugin() in your config and has Payload initialised?',
    )
  }
  return payload.resendBroadcasts
}

declare module 'payload' {
  // Merged into the exported BasePayload class; attached by the plugin in onInit.
  interface BasePayload {
    resendBroadcasts: ResendBroadcastsAPI
  }
}
