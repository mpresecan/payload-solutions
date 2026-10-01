import type { Block } from 'payload'

import { tokenAwareUrlHook } from './button-block.js'

export const IMAGE_BLOCK_SLUG = 'image'

/** Widths an image can take, in pixels of the default template's 520px content column. */
export const IMAGE_WIDTHS = { full: 520, half: 260, third: 174 } as const
export type ImageWidth = keyof typeof IMAGE_WIDTHS

/**
 * An image from the media collection. Email clients load images from a public URL, so the block
 * stores the upload and the renderer turns its `url` into an absolute one at send time; the
 * width is constrained to the content column, so a full-size photo cannot break the layout.
 */
export function createImageBlock(mediaCollection: string): Block {
  return {
    slug: IMAGE_BLOCK_SLUG,
    fields: [
      {
        name: 'image',
        type: 'upload',
        relationTo: mediaCollection as never,
        required: true,
      },
      {
        name: 'alt',
        type: 'text',
        admin: {
          description:
            'Read aloud by screen readers and shown when a mail client blocks images. Empty uses the alt text of the upload.',
        },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'width',
            type: 'select',
            defaultValue: 'full',
            options: [
              { label: 'Full width', value: 'full' },
              { label: 'Half', value: 'half' },
              { label: 'Third', value: 'third' },
            ],
            required: true,
          },
          {
            name: 'align',
            type: 'select',
            admin: { condition: (_data, siblingData) => siblingData?.width !== 'full' },
            defaultValue: 'center',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
            ],
          },
        ],
      },
      {
        name: 'href',
        type: 'text',
        admin: {
          description:
            'Optional. Clicking the image opens this URL; variables such as {{site.url}} work.',
        },
        hooks: { beforeChange: [tokenAwareUrlHook] },
        label: 'Link',
      },
      {
        name: 'caption',
        type: 'text',
        admin: { description: 'Optional small print under the image.' },
      },
    ],
    interfaceName: 'NewsletterImageBlock',
    labels: { plural: 'Images', singular: 'Image' },
  }
}
