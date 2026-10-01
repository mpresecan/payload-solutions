import type { FeatureProviderServer } from '@payloadcms/richtext-lexical'
import type { Field, RichTextAdapterProvider, TextField } from 'payload'

import {
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

import { ButtonBlock, tokenAwareUrlHook } from './button-block.js'
import { createImageBlock } from './image-block.js'

export type EmailEditorOptions = {
  /** Upload collection the Image block picks from. Without it there is no Image block. */
  mediaCollection?: string
}

/**
 * Features that render predictably in mail clients. Tables, alignment and inline code are left out
 * on purpose, and images come only as the Image block — never Lexical's own upload node, which has
 * no width limit and no way to make its URL absolute. Pass your own `editor` to change the set.
 */
export const emailEditorFeatures = ({
  mediaCollection,
}: EmailEditorOptions = {}): FeatureProviderServer<any, any, any>[] => [
  ParagraphFeature(),
  HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] }),
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  LinkFeature({
    // Only external links: editors write URLs (or {{tokens}}), never pick documents.
    enabledCollections: [],
    fields: ({ defaultFields }) =>
      defaultFields.map((field): Field => {
        if ('name' in field && field.name === 'url') {
          const urlField = field as TextField
          return { ...urlField, hooks: { ...urlField.hooks, beforeChange: [tokenAwareUrlHook] } }
        }
        return field as Field
      }),
  }),
  UnorderedListFeature(),
  OrderedListFeature(),
  BlockquoteFeature(),
  HorizontalRuleFeature(),
  BlocksFeature({
    blocks: mediaCollection ? [ButtonBlock, createImageBlock(mediaCollection)] : [ButtonBlock],
  }),
  FixedToolbarFeature(),
  InlineToolbarFeature(),
]

/** The editor used for `body` (and the settings header/footer) unless the plugin gets `options.editor`. */
export const createEmailEditor = (
  options: EmailEditorOptions = {},
): RichTextAdapterProvider<any, any, any> =>
  lexicalEditor({ features: emailEditorFeatures(options) })
