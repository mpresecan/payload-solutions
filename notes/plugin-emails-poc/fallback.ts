// No `./payload-types.js` import: GeneratedTypes is empty → TypedEmails must fall back to untyped, and calls must still compile.
import type { BasePayload, GeneratedTypes, Payload } from 'payload'
type EmailShape = { input: unknown; variables: unknown }
type UntypedEmails = Record<string, { input: Record<string, unknown>; variables: Record<string, unknown> }>
export type TypedEmails = GeneratedTypes extends { emails: infer E extends Record<string, EmailShape> } ? E : UntypedEmails
export type EmailSlug = keyof TypedEmails & string
export type EmailInput<S extends EmailSlug> = TypedEmails[S]['input']
declare function send<S extends EmailSlug>(slug: S, args: { input: EmailInput<S> }): Promise<void>
export async function usage(_p: BasePayload | Payload) {
  await send('anything-goes', { input: { user: 'x', url: 'y' } })
}
