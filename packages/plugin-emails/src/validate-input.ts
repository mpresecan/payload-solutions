import type { Field } from 'payload'

/**
 * Light structural check of `input` against `inputSchema`: required keys, primitive types, select
 * options. Not a substitute for Payload validation; enough to catch call-site mistakes early.
 */
export function validateInput(fields: Field[] | undefined, input: unknown, path = ''): string[] {
  const errors: string[] = []
  if (!fields?.length) {
    return errors
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [`${path || 'input'} must be an object`]
  }
  const data = input as Record<string, unknown>
  for (const field of fields) {
    if (!('name' in field) || !field.name) {
      continue
    }
    const key = `${path}${field.name}`
    const value = data[field.name]
    const missing = value === undefined || value === null || value === ''
    if (missing) {
      if ('required' in field && field.required) {
        errors.push(`${key} is required`)
      }
      continue
    }
    switch (field.type) {
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`)
        } else {
          value.forEach((row, i) => errors.push(...validateInput(field.fields, row, `${key}.${i}.`)))
        }
        break
      case 'checkbox':
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`)
        }
        break
      case 'date':
        if (!(value instanceof Date) && Number.isNaN(new Date(value as string).getTime())) {
          errors.push(`${key} must be a date`)
        }
        break
      case 'email':
      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          errors.push(`${key} must be a string`)
        }
        break
      case 'group':
        errors.push(...validateInput(field.fields, value, `${key}.`))
        break
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`${key} must be a number`)
        }
        break
      case 'radio':
      case 'select': {
        const allowed = field.options.map((o) => (typeof o === 'string' ? o : o.value))
        if (!allowed.includes(String(value))) {
          errors.push(`${key} must be one of ${allowed.join(', ')}`)
        }
        break
      }
      case 'relationship':
        if (!['number', 'object', 'string'].includes(typeof value)) {
          errors.push(`${key} must be an id or a document`)
        }
        break
      default:
        break
    }
  }
  return errors
}
