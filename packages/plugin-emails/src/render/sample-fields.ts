import type { Field, Payload } from 'payload'

import type { SampleFieldSpec } from '../types.js'

const SUPPORTED = new Set<SampleFieldSpec['type']>([
  'array',
  'checkbox',
  'date',
  'email',
  'group',
  'json',
  'number',
  'radio',
  'relationship',
  'select',
  'text',
  'textarea',
])

function labelFor(field: Field & { label?: unknown; name: string }): string {
  if (typeof field.label === 'string') {
    return field.label
  }
  return field.name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * Turn a definition's `inputSchema` into something the admin can render as a form. Relationship
 * fields carry only their target collections: the admin renders Payload's `RelationshipInput`, which
 * searches, paginates and resolves titles itself.
 */
export async function buildSampleFields(
  payload: Payload,
  fields: Field[] | undefined,
  { depth = 0 }: { depth?: number } = {},
): Promise<SampleFieldSpec[]> {
  const specs: SampleFieldSpec[] = []
  for (const field of fields ?? []) {
    if (!('name' in field) || !field.name || !SUPPORTED.has(field.type as SampleFieldSpec['type'])) {
      continue
    }
    const spec: SampleFieldSpec = {
      label: labelFor(field as never),
      name: field.name,
      type: field.type as SampleFieldSpec['type'],
    }
    if ('required' in field && field.required) {
      spec.required = true
    }
    if ('hasMany' in field && field.hasMany) {
      spec.hasMany = true
    }
    const description = (field as { admin?: { description?: unknown } }).admin?.description
    if (typeof description === 'string') {
      spec.description = description
    }
    if ('defaultValue' in field && typeof field.defaultValue !== 'function' && field.defaultValue !== undefined) {
      spec.defaultValue = field.defaultValue
    }

    if (field.type === 'select' || field.type === 'radio') {
      spec.options = field.options.map((o) =>
        typeof o === 'string' ? { label: o, value: o } : { label: String(o.label ?? o.value), value: String(o.value) },
      )
    }

    if (field.type === 'relationship') {
      const relationTo = (Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]).filter(
        (slug): slug is string => typeof slug === 'string' && Boolean(payload.collections[slug]),
      )
      if (!relationTo.length) {
        continue
      }
      spec.relationTo = relationTo
    }

    if ((field.type === 'group' || field.type === 'array') && depth < 2) {
      spec.fields = await buildSampleFields(payload, field.fields, { depth: depth + 1 })
    }

    specs.push(spec)
  }
  return specs
}
