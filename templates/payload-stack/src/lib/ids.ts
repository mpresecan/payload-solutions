import type { Payload } from 'payload'

/**
 * Better Auth hands out ids as strings; Payload's Postgres and SQLite adapters use numbers by
 * default while MongoDB uses strings. Normalize before using a Better Auth id in a Payload query
 * or relationship so the same code works on every database the CLI offers.
 */
export function toPayloadId(payload: Payload, id: string | number): string | number {
  if (payload.db.defaultIDType === 'number' && typeof id === 'string' && /^\d+$/.test(id)) {
    return Number(id)
  }
  return id
}
