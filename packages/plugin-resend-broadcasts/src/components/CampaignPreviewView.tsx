import type { DocumentViewServerProps } from 'payload'

import { Gutter } from '@payloadcms/ui'
import React from 'react'

import type { ResendBroadcastsAPI } from '../types.js'

import { CampaignPreviewClient } from '../exports/client.js'

/** "Preview & send" document tab. Loads what the client needs; the panel itself is a client component. */
export const CampaignPreviewView = async (props: DocumentViewServerProps) => {
  const { doc, initPageResult } = props
  const { collectionConfig, req } = initPageResult
  const api = (req.payload as unknown as { resendBroadcasts?: ResendBroadcastsAPI })
    .resendBroadcasts
  const id = doc?.id as number | string | undefined

  if (!id || !collectionConfig || !api) {
    return (
      <Gutter>
        <p>Save the campaign first to preview and send it.</p>
      </Gutter>
    )
  }

  const { options } = api
  const { docs: lists } = await req.payload.find({
    collection: options.slugs.lists as never,
    depth: 0,
    limit: 100,
    overrideAccess: false,
    req,
    sort: 'name',
    user: req.user,
  })

  let testRecipient = (req.user as { email?: string } | null)?.email ?? ''
  try {
    const settings = (await req.payload.findGlobal({
      slug: options.slugs.settings as never,
      depth: 0,
      overrideAccess: true,
      req,
    })) as {
      testRecipient?: string
    }
    testRecipient = settings.testRecipient || testRecipient
  } catch {
    // fall back to the editor's own address
  }

  const rawList = doc?.list as { id: number | string } | null | number | string | undefined
  const listId = rawList && typeof rawList === 'object' ? rawList.id : rawList

  return (
    <CampaignPreviewClient
      campaignsSlug={collectionConfig.slug}
      id={String(id)}
      initialListId={listId === undefined || listId === null ? null : String(listId)}
      lists={(lists as unknown as Array<{ id: number | string; name?: string }>).map((l) => ({
        id: String(l.id),
        name: l.name ?? String(l.id),
      }))}
      listsSlug={options.slugs.lists}
      testRecipient={testRecipient}
    />
  )
}
