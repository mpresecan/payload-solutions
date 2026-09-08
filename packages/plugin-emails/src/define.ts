import type { Field } from 'payload'

import { createHash } from 'crypto'

import type {
  EmailDefinition,
  EmailSlug,
  SanitizedEmailDefinition,
  VariableManifest,
} from './types.js'

/** Identity helper that gives `resolve`, `to` and `sample` the types generated for `slug`. */
export function defineEmail<S extends EmailSlug>(definition: EmailDefinition<S>): EmailDefinition<S> {
  return definition
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const VARIABLE_PATTERN = /^[a-zA-Z_][\w-]*(?:\.[a-zA-Z_][\w-]*)*$/
const SENSITIVE_PATTERN = /(token|secret|password|apikey|api-key)$/i

/** Field types the sample-data UI and the light input validator understand. */
export const SUPPORTED_INPUT_FIELD_TYPES = new Set([
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

export function pascalCase(slug: string): string {
  return slug.replace(/(^|[-_ ])(\w)/g, (_, __, c: string) => c.toUpperCase())
}

const SCALAR_INPUT_TYPES = new Set(['checkbox', 'date', 'email', 'number', 'radio', 'select', 'text', 'textarea'])

/** Variables implied by `inputSchema` when a definition has no explicit manifest. */
export function variablesFromInputSchema(fields: Field[] | undefined): VariableManifest {
  const manifest: VariableManifest = {}
  for (const field of fields ?? []) {
    if (!('name' in field) || !field.name) {
      continue
    }
    if (!SCALAR_INPUT_TYPES.has(field.type)) {
      continue
    }
    const description = (field as { admin?: { description?: unknown } }).admin?.description
    manifest[field.name] = {
      type: field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'string',
      ...(typeof description === 'string' ? { description } : {}),
    }
  }
  return manifest
}

function assertInputSchema(slug: string, fields: Field[] | undefined, path = ''): void {
  for (const field of fields ?? []) {
    if (!('name' in field) || !field.name) {
      throw new Error(`[plugin-emails] "${slug}": every inputSchema field needs a name (at "${path}").`)
    }
    if (!SUPPORTED_INPUT_FIELD_TYPES.has(field.type)) {
      throw new Error(
        `[plugin-emails] "${slug}": inputSchema field "${path}${field.name}" has type "${field.type}", which is not supported. Use one of: ${[...SUPPORTED_INPUT_FIELD_TYPES].join(', ')}.`,
      )
    }
    if (field.type === 'relationship' && (Array.isArray(field.relationTo) || field.hasMany)) {
      throw new Error(
        `[plugin-emails] "${slug}": inputSchema field "${path}${field.name}" must be a single relationship to one collection.`,
      )
    }
    if (field.type === 'group' || field.type === 'array') {
      assertInputSchema(slug, field.fields, `${path}${field.name}.`)
    }
  }
}

export function sanitizeDefinition(definition: EmailDefinition<any>): SanitizedEmailDefinition {
  const { slug } = definition
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new Error(`[plugin-emails] Invalid email slug "${slug}". Use kebab-case, e.g. "password-reset".`)
  }
  if (!definition.label) {
    throw new Error(`[plugin-emails] "${slug}": label is required.`)
  }
  if (!definition.defaults?.subject || !definition.defaults?.body) {
    throw new Error(`[plugin-emails] "${slug}": defaults.subject and defaults.body are required.`)
  }
  assertInputSchema(slug, definition.inputSchema)

  const variables = definition.variables ?? variablesFromInputSchema(definition.inputSchema)
  for (const name of Object.keys(variables)) {
    if (!VARIABLE_PATTERN.test(name)) {
      throw new Error(`[plugin-emails] "${slug}": variable "${name}" must be a dotted identifier, e.g. "user.name".`)
    }
    if (SENSITIVE_PATTERN.test(name) && !definition.allowSensitiveVariables) {
      throw new Error(
        `[plugin-emails] "${slug}": variable "${name}" looks like a secret. Expose links as type "url" instead, or set allowSensitiveVariables: true.`,
      )
    }
  }

  const audience = definition.audience ?? 'user'
  if (audience === 'user' && !definition.to) {
    // Not fatal: callers may always pass `to`. Warned at send time when neither is present.
  }

  return {
    ...definition,
    audience,
    interfaceName: definition.interfaceName ?? `Email${pascalCase(slug)}`,
    template: definition.template ?? 'default',
    variables,
  }
}

/** Hash of the code-owned metadata; stored on the document to detect when a refresh is needed. */
export function definitionHash(definition: SanitizedEmailDefinition): string {
  const payload = JSON.stringify({
    audience: definition.audience,
    description: definition.description ?? '',
    group: definition.group ?? '',
    label: definition.label,
    template: definition.template,
    required: Boolean(definition.required),
    trigger: definition.trigger ?? '',
    variables: definition.variables,
  })
  return createHash('sha1').update(payload).digest('hex').slice(0, 16)
}

/** The stored, read-only copy of a definition's metadata. */
export function codeOwnedFields(definition: SanitizedEmailDefinition): Record<string, unknown> {
  return {
    audience: definition.audience,
    definitionHash: definitionHash(definition),
    description: definition.description ?? '',
    group: definition.group ?? '',
    inUse: true,
    label: definition.label,
    required: Boolean(definition.required),
    trigger: definition.trigger ?? '',
    variables: definition.variables,
  }
}
