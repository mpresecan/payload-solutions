import type { Block, FieldHook } from 'payload'

import { validateUrl } from '@payloadcms/richtext-lexical'

import { BUTTON_BLOCK_SLUG } from '../render/lexical.js'

const TOKEN_URL = /^\{\{\s*[a-zA-Z_][\w-]*(?:\.[a-zA-Z_][\w-]*)*\s*\}\}/

/**
 * The stock link `url` field percent-encodes anything that fails `validateUrl`, which would turn
 * `{{url}}` into `%7B%7Burl%7D%7D`. Keep token URLs verbatim, apply the stock behaviour otherwise.
 */
export const tokenAwareUrlHook: FieldHook = ({ value }) => {
  if (!value || typeof value !== 'string') {
    return value
  }
  if (TOKEN_URL.test(value.trim())) {
    return value.trim()
  }
  if (!validateUrl(value)) {
    return encodeURIComponent(value)
  }
  return value
}

/**
 * Shown above the repeated URL when a button has its fallback turned on. Editors can reword or
 * clear it per email; clearing it leaves the bare link.
 */
export const DEFAULT_FALLBACK_TEXT = 'If the button does not work, paste this link into your browser:'

/** Call-to-action button. Importable from Markdown as `<Button label="…" url="…" />`. */
export const ButtonBlock: Block = {
  slug: BUTTON_BLOCK_SLUG,
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'url',
      type: 'text',
      admin: { description: 'A full URL or a variable such as {{url}}.' },
      hooks: { beforeChange: [tokenAwareUrlHook] },
      required: true,
    },
    {
      name: 'align',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
      ],
    },
    {
      name: 'fallback',
      type: 'checkbox',
      admin: {
        description:
          'Repeats the URL as plain text under the button, in smaller type. Some clients strip links, and some readers forward the message as text.',
      },
      defaultValue: true,
      label: 'Show the link below the button',
    },
    {
      name: 'fallbackText',
      type: 'text',
      admin: {
        condition: (_data, siblingData) => siblingData?.fallback !== false,
        description: 'Leave empty to show the link on its own.',
      },
      defaultValue: DEFAULT_FALLBACK_TEXT,
    },
  ],
  interfaceName: 'EmailButtonBlock',
  jsx: {
    // Only non-default fallback settings are written out, so the common case stays
    // `<Button label="…" url="…" />`.
    export: ({ fields }) => ({
      props: {
        align: fields.align ?? 'left',
        label: fields.label ?? '',
        url: fields.url ?? '',
        ...(fields.fallback === false ? { fallback: 'false' } : {}),
        ...(fields.fallback !== false && fields.fallbackText !== DEFAULT_FALLBACK_TEXT
          ? { fallbackText: fields.fallbackText ?? '' }
          : {}),
      },
    }),
    import: ({ props }) => ({
      align: props.align === 'center' ? 'center' : 'left',
      // Absent means on: a button written in Markdown gets the fallback without asking for it.
      fallback: props.fallback !== false && props.fallback !== 'false',
      fallbackText: props.fallbackText === undefined ? DEFAULT_FALLBACK_TEXT : String(props.fallbackText),
      label: String(props.label ?? ''),
      url: String(props.url ?? ''),
    }),
  },
  labels: { plural: 'Buttons', singular: 'Button' },
}
