import type { Field } from 'payload'

/** Marks text fields as localized only when the host project has localization configured. */
export function localize(fields: Field[], localized: boolean): Field[] {
  if (!localized) return fields
  return fields.map((field) => {
    if ('fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: localize(field.fields, localized) } as Field
    }
    if ('tabs' in field) {
      return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: localize(tab.fields, localized) })) } as Field
    }
    if ((field.type === 'text' || field.type === 'textarea' || field.type === 'richText') && 'name' in field && !(field as { localized?: boolean }).localized) {
      const skip = (field as { custom?: { noLocalize?: boolean } }).custom?.noLocalize
      return skip ? field : ({ ...field, localized: true } as Field)
    }
    return field
  })
}

/** Slug-like keys: lowercase letters, digits, dashes and underscores. */
export const KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/

export function validateKey(value: unknown): true | string {
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) {
    return 'Use lowercase letters, digits, dashes or underscores, starting with a letter (e.g. "analytics").'
  }
  return true
}
