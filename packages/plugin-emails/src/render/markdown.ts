import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { SanitizedConfig } from 'payload'

import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'

import { emailEditorFeatures } from '../editor/features.js'

const cache = new WeakMap<SanitizedConfig, Promise<Awaited<ReturnType<typeof editorConfigFactory.fromFeatures>>>>()

function getEditorConfig(config: SanitizedConfig) {
  let promise = cache.get(config)
  if (!promise) {
    promise = editorConfigFactory.fromFeatures({ config, features: emailEditorFeatures() })
    cache.set(config, promise)
  }
  return promise
}

export function isSerializedEditorState(value: unknown): value is SerializedEditorState {
  return Boolean(value && typeof value === 'object' && 'root' in (value as object))
}

/**
 * Markdown (with `<Button label="…" url="…" />`) → Lexical state, using the plugin's editor
 * features so blocks and links import the same way the admin would create them.
 */
export async function markdownToLexical(
  config: SanitizedConfig,
  markdown: string,
): Promise<SerializedEditorState> {
  const editorConfig = await getEditorConfig(config)
  return convertMarkdownToLexical({ editorConfig, markdown: markdown.trim() }) as SerializedEditorState
}
