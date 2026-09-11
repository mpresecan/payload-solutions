'use client'

import type { ClientConfig } from 'payload'

export function apiBase(config: ClientConfig, collectionSlug: string): string {
  return `${config.serverURL ?? ''}${config.routes.api}/${collectionSlug}`
}

export async function call<T = unknown>(url: string, init: RequestInit = {}): Promise<{ body: T; ok: boolean; status: number }> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
  let body: T = {} as T
  try {
    body = (await res.json()) as T
  } catch {
    // no body
  }
  return { body, ok: res.ok, status: res.status }
}
