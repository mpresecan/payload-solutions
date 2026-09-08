import type { Payload } from 'payload'

import type { EmailsAPI, EmailSlug, RenderArgs, RenderedEmail, SendArgs, SendResult } from './types.js'

export { defineEmail, definitionHash, sanitizeDefinition } from './define.js'
export { ButtonBlock, tokenAwareUrlHook } from './editor/button-block.js'
export { createEmailEditor, emailEditorFeatures } from './editor/features.js'
export { emailsPlugin, PLUGIN_SLUG, sanitizeOptions } from './plugin.js'
export { escapeHtml, extractTokens, findTokenProblems, flattenVariables, interpolate } from './render/interpolate.js'
export { interpolateToNodes, lexicalToReact } from './render/lexical-react.js'
export { collectNodeStrings, collectTemplateStrings } from './render/lexical.js'
export { DefaultTemplate, defaultStyles, templatePreviewCopy } from './render/template.js'
export { markdownToLexical } from './render/markdown.js'
export { populate } from './render/render.js'
export { syncEmails } from './seed.js'
export { EmailNotDefinedError, SEND_TASK_SLUG } from './send.js'
export type * from './types.js'
export { validateInput } from './validate-input.js'

/** Function form of `payload.emails.send` for code that prefers explicit imports. */
export function sendEmail<S extends EmailSlug>(payload: Payload, slug: S, args: SendArgs<S>): Promise<SendResult> {
  return getEmailsAPI(payload).send(slug, args)
}

/** Function form of `payload.emails.render`. */
export function renderEmail<S extends EmailSlug>(payload: Payload, slug: S, args: RenderArgs<S>): Promise<RenderedEmail> {
  return getEmailsAPI(payload).render(slug, args)
}

export function getEmailsAPI(payload: Payload): EmailsAPI {
  if (!payload.emails) {
    throw new Error('[plugin-emails] payload.emails is not available. Is emailsPlugin() in your config and has Payload initialised?')
  }
  return payload.emails
}

declare module 'payload' {
  // Merged into the exported BasePayload class; attached by the plugin in onInit.
  interface BasePayload {
    emails: EmailsAPI
  }
}
