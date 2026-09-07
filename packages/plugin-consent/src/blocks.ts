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

/**
 * Renders the processor register in one of the shapes a legal document needs.
 * `recipients` and `transfers` belong in the privacy policy; `subprocessors`, `annex` and
 * `changes` belong on the public sub-processor page and in the DPA.
 */
export const ProcessorTableBlock: Block = {
  slug: 'processorTable',
  interfaceName: 'ConsentProcessorTableBlock',
  labels: { singular: 'Processor table', plural: 'Processor tables' },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'mode',
          type: 'select',
          defaultValue: 'recipients',
          required: true,
          options: [
            { label: 'Recipients — who receives data and why (privacy policy)', value: 'recipients' },
            { label: 'Transfers — country and safeguard per recipient (privacy policy)', value: 'transfers' },
            { label: 'Sub-processors — the public list', value: 'subprocessors' },
            { label: 'Annex III — the DPA annex shape', value: 'annex' },
            { label: 'Change log — recent additions and removals', value: 'changes' },
          ],
          admin: { width: '60%' },
        },
        {
          name: 'showRole',
          type: 'checkbox',
          defaultValue: true,
          admin: { width: '40%', description: 'Show whether each recipient is a processor or an independent controller.' },
        },
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
