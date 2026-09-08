import type { Field, TextField } from 'payload'

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

/**
 * Features that render predictably in mail clients. Tables, alignment, inline code and uploads are
 * left out on purpose; pass your own `editor` to the plugin to change the set.
 */
export const emailEditorFeatures = () => [
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
  BlocksFeature({ blocks: [ButtonBlock] }),
  FixedToolbarFeature(),
  InlineToolbarFeature(),
]

/** The editor used for `body` (and the settings header/footer) unless the plugin gets `options.editor`. */
export const createEmailEditor = () => lexicalEditor({ features: emailEditorFeatures() })
