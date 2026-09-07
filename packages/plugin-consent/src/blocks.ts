import type { Block } from 'payload'

/** Renders the trackers table (grouped by category) inside a legal page. */
export const CookieTableBlock: Block = {
  slug: 'cookieTable',
  interfaceName: 'ConsentCookieTableBlock',
  labels: { singular: 'Cookie table', plural: 'Cookie tables' },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'groupBy',
          type: 'select',
          defaultValue: 'category',
          options: [
            { label: 'Category', value: 'category' },
            { label: 'Vendor', value: 'vendor' },
          ],
          admin: { width: '50%' },
        },
        { name: 'showDurations', type: 'checkbox', defaultValue: true, admin: { width: '50%' } },
      ],
    },
  ],
}

/** Renders "Version xxxx, effective DATE" for the page. */
export const PolicyVersionBlock: Block = {
  slug: 'policyVersion',
  interfaceName: 'ConsentPolicyVersionBlock',
  labels: { singular: 'Policy version line', plural: 'Policy version lines' },
  fields: [{ name: 'prefix', type: 'text', defaultValue: 'Version' }],
}

/** Lexical node for a block, as stored in a Payload rich text field. */
export function lexicalBlockNode(blockType: string, fields: Record<string, unknown>) {
  return {
    type: 'block',
    version: 2,
    format: '',
    fields: {
      id: `${blockType}-${Math.random().toString(36).slice(2, 10)}`,
      blockName: '',
      blockType,
      ...fields,
    },
  }
}
