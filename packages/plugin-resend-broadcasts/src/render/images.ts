import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload, PayloadRequest } from 'payload'

import { IMAGE_BLOCK_SLUG } from '../editor/image-block.js'

type AnyNode = {
  [key: string]: unknown
  children?: AnyNode[]
  fields?: Record<string, unknown>
  type: string
}

export type MediaDoc = {
  alt?: null | string
  height?: null | number
  id: number | string
  url?: null | string
  width?: null | number
}

function imageNodes(root: AnyNode | undefined): AnyNode[] {
  const out: AnyNode[] = []
  const walk = (node: AnyNode) => {
    if (node.type === 'block' && node.fields?.blockType === IMAGE_BLOCK_SLUG) {
      out.push(node)
    }
    for (const child of node.children ?? []) {
      walk(child)
    }
  }
  if (root) {
    walk(root)
  }
  return out
}

/**
 * The body with every Image block's upload replaced by its media document, whatever depth the
 * campaign was read at. One query for all of them; an upload that no longer exists becomes null,
 * and the renderer skips the block.
 *
 * Also reports the uploads a reader could not open: files Payload serves itself
 * (`/api/<media>/file/…`) whose documents an anonymous request may not read. A mail client never
 * carries a login, so those images would arrive broken. Files on public storage are not affected.
 */
export async function populateImageBlocks({
  body,
  collection,
  payload,
  req,
}: {
  body: null | SerializedEditorState | undefined
  collection: string
  payload: Payload
  req?: PayloadRequest
}): Promise<{ body: null | SerializedEditorState | undefined; loginRequired: MediaDoc[] }> {
  if (!body) {
    return { body, loginRequired: [] }
  }
  const copy = structuredClone(body)
  const nodes = imageNodes(copy.root as unknown as AnyNode)
  const ids = [
    ...new Set(
      nodes
        .map((node) => node.fields?.image)
        .map((value) => (value && typeof value === 'object' ? (value as MediaDoc).id : value))
        .filter(
          (value): value is number | string =>
            typeof value === 'number' || typeof value === 'string',
        ),
    ),
  ]
  if (!ids.length) {
    return { body: copy, loginRequired: [] }
  }
  const { docs } = await payload.find({
    collection: collection as never,
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
    pagination: false,
    req,
    where: { id: { in: ids } },
  })
  const byId = new Map((docs as unknown as MediaDoc[]).map((doc) => [String(doc.id), doc]))
  for (const node of nodes) {
    const value = node.fields!.image
    const id = value && typeof value === 'object' ? (value as MediaDoc).id : value
    node.fields!.image = id === null || id === undefined ? null : (byId.get(String(id)) ?? null)
  }

  const servedByPayload = [...byId.values()].filter((doc) =>
    doc.url?.includes(`/${collection}/file/`),
  )
  let readable = new Set<string>()
  if (servedByPayload.length) {
    try {
      const anonymous = await payload.find({
        collection: collection as never,
        depth: 0,
        limit: servedByPayload.length,
        overrideAccess: false,
        pagination: false,
        where: { id: { in: servedByPayload.map((doc) => doc.id) } },
      })
      readable = new Set((anonymous.docs as unknown as MediaDoc[]).map((doc) => String(doc.id)))
    } catch {
      readable = new Set()
    }
  }
  return {
    body: copy,
    loginRequired: servedByPayload.filter((doc) => !readable.has(String(doc.id))),
  }
}

/**
 * An upload URL as a mail client can fetch it. Relative URLs get `base` in front. With `serverURL`
 * set, Payload already returns absolute URLs on that host — those are moved onto `base` when one
 * is given, so a site whose admin runs on an internal host can still point images at its public one.
 */
export function absoluteUrl(url: string, base: string | undefined, serverURL?: string): string {
  const trimmedBase = base?.replace(/\/$/, '')
  if (!/^https?:\/\//i.test(url)) {
    return trimmedBase ? `${trimmedBase}/${url.replace(/^\//, '')}` : url
  }
  const origin = serverURL?.replace(/\/$/, '')
  if (trimmedBase && origin && origin !== trimmedBase && url.startsWith(`${origin}/`)) {
    return `${trimmedBase}${url.slice(origin.length)}`
  }
  return url
}

const PRIVATE_HOST = [
  /^localhost$/i,
  /\.(?:local|localhost|internal|test)$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
]

/** Whether a mail client on the internet could load this image URL. */
export function isPublicImageUrl(src: string): boolean {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false
  }
  return !PRIVATE_HOST.some((pattern) => pattern.test(url.hostname))
}

/** Every `<img src>` in rendered HTML that a reader's mail client could not load. */
export function findPrivateImages(html: string): string[] {
  const out = new Set<string>()
  for (const match of html.matchAll(/<img\b[^>]*?\ssrc="([^"]*)"/gi)) {
    const src = match[1].replaceAll('&amp;', '&')
    if (!isPublicImageUrl(src)) {
      out.add(src)
    }
  }
  return [...out]
}
