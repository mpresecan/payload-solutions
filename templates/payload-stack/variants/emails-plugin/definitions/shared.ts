import type { Field } from 'payload'

/**
 * Helpers shared by every definition file.
 *
 * `inputSchema` describes what the calling code passes; `variables` describes what editors may type
 * into the copy. `resolve` turns one into the other. Keeping the two apart is the point: call sites
 * pass ids and raw values, editors see `{{plan.name}}`.
 */

/**
 * Narrows the `input` a definition receives.
 *
 * Before `pnpm generate:types` has run, the plugin types `input` as an open record, because the
 * per-email interfaces are generated from these very `inputSchema` fields. After it runs, `input`
 * is the generated interface and this cast is a no-op. Either way the shape written here is the
 * one the definition documents.
 */
export const as = <T>(value: unknown): T => value as T

/** A value that is safe to hand back as a recipient. */
export const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * `email` + the link the message is built around, with a validity window: the shape most auth
 * emails share. `linkVariables` and `resolveLink` are its other two thirds — change one, change all
 * three, and `pnpm generate:types` will tell you if you missed one.
 */
export function linkInput(options: { expiresIn: number }): Field[] {
  return [
    { name: 'email', type: 'email', required: true, admin: { description: 'Who the message goes to' } },
    { name: 'url', type: 'text', required: true, admin: { description: 'The link the button points at' } },
    {
      name: 'expiresIn',
      type: 'number',
      defaultValue: options.expiresIn,
      admin: { description: 'How long the link stays valid, in minutes' },
    },
  ]
}

/** The variable manifest matching `linkInput`. */
export function linkVariables(example: { expires: number; url: string }) {
  return {
    email: { description: 'Recipient address', example: 'ada@example.com' },
    url: { description: 'The action link', example: example.url, type: 'url' as const },
    'expires.in': { description: 'Validity window in minutes', example: example.expires, type: 'number' as const },
  }
}

/** The resolver matching `linkInput` / `linkVariables`. */
export function resolveLink(input: unknown, fallbackExpiry: number) {
  const { email, expiresIn, url } = as<{ email: string; expiresIn?: number; url: string }>(input)
  return { email, url, 'expires.in': expiresIn ?? fallbackExpiry }
}

/** Who a billing email is about: the paying account, and where the notice should land. */
export const billingInput: Field[] = [
  { name: 'email', type: 'email', required: true, admin: { description: 'Billing contact' } },
  { name: 'accountName', type: 'text', admin: { description: 'User or organization the subscription belongs to' } },
  { name: 'planName', type: 'text', required: true },
]

export const billingVariables = {
  'account.email': { description: 'Billing contact', example: 'ada@example.com' },
  'account.name': { description: 'User or organization name', example: 'Acme Inc' },
  'plan.name': { description: 'Plan the subscription is on', example: 'Team' },
}

export function resolveBilling(input: unknown) {
  const { accountName, email, planName } = as<{ accountName?: string; email: string; planName: string }>(input)
  return { 'account.email': email, 'account.name': accountName ?? '', 'plan.name': planName }
}
