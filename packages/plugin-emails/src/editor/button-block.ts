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
  ],
  interfaceName: 'EmailButtonBlock',
  jsx: {
    export: ({ fields }) => ({
      props: {
        align: fields.align ?? 'left',
        label: fields.label ?? '',
        url: fields.url ?? '',
      },
    }),
    import: ({ props }) => ({
      align: props.align === 'center' ? 'center' : 'left',
      label: String(props.label ?? ''),
      url: String(props.url ?? ''),
    }),
  },
  labels: { plural: 'Buttons', singular: 'Button' },
}
