import type { CollectionConfig, Where } from 'payload'

import { APIError } from 'payload'

import type { Runtime } from '../runtime.js'
import type { ListDoc, SanitizedOptions } from '../types.js'

import { COMPONENT_PREFIX, INTERNAL_WRITE } from '../constants.js'
import { createListEndpoints } from '../endpoints/lists.js'
import { isNotFound } from '../resend/client.js'

/**
 * A list is a named slice of one source collection — every document, or the ones a filter matches —
 * mirrored one-to-one onto a Resend segment. Campaigns are sent to a list.
 */
export function createListsCollection(
  options: SanitizedOptions,
  runtime: Runtime,
): CollectionConfig {
  const canManage = ({
    req,
  }: {
    req: Parameters<SanitizedOptions['access']['manage']>[0]['req']
  }) => options.access.manage({ req })

  return {
    slug: options.slugs.lists,
    access: { create: canManage, delete: canManage, read: canManage, update: canManage },
    admin: {
      components: {
        beforeListTable: [
          {
            clientProps: { runsSlug: options.slugs.syncRuns },
            path: `${COMPONENT_PREFIX}/client#ResyncAllButton`,
          },
        ],
      },
      defaultColumns: ['name', 'source', 'memberCount', 'lastSyncedAt'],
      description:
        'Each list is a Resend segment built from one collection. Membership follows the documents: saving, filtering or deleting them updates the segment.',
      group: options.adminGroup,
      useAsTitle: 'name',
    },
    endpoints: options.disabled ? [] : createListEndpoints(options, runtime),
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'textarea' },
      {
        name: 'source',
        type: 'select',
        admin: { description: 'The collection whose documents are the subscribers of this list.' },
        defaultValue: options.sources[0].collection,
        options: options.sources.map((s) => ({
          label: s.label ?? s.collection,
          value: s.collection,
        })),
        required: true,
      },
      {
        name: 'filter',
        type: 'json',
        admin: {
          description:
            'Optional Payload query that narrows the source, e.g. {"plan": {"equals": "pro"}}. Empty means everyone in the collection. Unsubscribed documents may match; Resend never mails them.',
        },
        validate: async (value, { req, siblingData }) => {
          if (value === null || value === undefined || value === '') {
            return true
          }
          if (typeof value !== 'object' || Array.isArray(value)) {
            return 'The filter must be a JSON object, like {"plan": {"equals": "pro"}}.'
          }
          const source = (siblingData as { source?: string })?.source
          if (!source || !req?.payload) {
            return true
          }
          try {
            await req.payload.count({
              collection: source as never,
              overrideAccess: true,
              req,
              where: value as Where,
            })
            return true
          } catch (error) {
            return `This filter does not run against "${source}": ${error instanceof Error ? error.message : String(error)}`
          }
        },
      },
      {
        name: 'syncStatus',
        type: 'ui',
        admin: {
          components: {
            Field: {
              clientProps: { runsSlug: options.slugs.syncRuns },
              path: `${COMPONENT_PREFIX}/client#ListSyncStatus`,
            },
          },
          position: 'sidebar',
        },
      },
      {
        name: 'segmentId',
        type: 'text',
        admin: { position: 'sidebar', readOnly: true },
        index: true,
        label: 'Resend segment',
      },
      {
        name: 'memberCount',
        type: 'number',
        admin: {
          description: 'Subscribed members at the last sync.',
          position: 'sidebar',
          readOnly: true,
        },
        label: 'Subscribed members',
      },
      {
        name: 'lastSyncedAt',
        type: 'date',
        admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', readOnly: true },
      },
      {
        name: 'syncError',
        type: 'textarea',
        admin: {
          condition: (data) => Boolean(data?.syncError),
          position: 'sidebar',
          readOnly: true,
        },
      },
    ],
    hooks: options.disabled
      ? {}
      : {
          afterChange: [
            async ({ context, doc, operation, previousDoc, req }) => {
              if (context[INTERNAL_WRITE]) {
                return doc
              }
              const list = doc as ListDoc
              const previous = previousDoc as ListDoc | undefined
              if (operation === 'update' && previous?.name !== list.name && list.segmentId) {
                try {
                  await runtime
                    .client()
                    .call('rename segment', (r) =>
                      r.segments.update(list.segmentId!, { name: list.name }),
                    )
                } catch (error) {
                  req.payload.logger.warn({
                    err: error,
                    msg: '[plugin-resend-broadcasts] Could not rename the Resend segment.',
                  })
                }
              }
              const membershipChanged =
                operation === 'create' ||
                previous?.source !== list.source ||
                JSON.stringify(previous?.filter ?? null) !== JSON.stringify(list.filter ?? null)
              if (membershipChanged) {
                // Filling a segment can take minutes on a large collection, so it never runs inside the save.
                await runtime.startResync({
                  lists: [list.id],
                  payload: req.payload,
                  req,
                  trigger: `list ${operation}`,
                })
              }
              return doc
            },
          ],
          afterDelete: [
            async ({ doc, req }) => {
              const segmentId = (doc as ListDoc).segmentId
              if (!segmentId) {
                return
              }
              try {
                await runtime.client().call('delete segment', (r) => r.segments.remove(segmentId))
              } catch (error) {
                if (!isNotFound(error)) {
                  req.payload.logger.warn({
                    err: error,
                    msg: '[plugin-resend-broadcasts] Could not delete the Resend segment.',
                  })
                }
              }
            },
          ],
          beforeChange: [
            async ({ context, data, operation, originalDoc }) => {
              if (context[INTERNAL_WRITE]) {
                return data
              }
              // Lists are mirrored by the plugin; these are never written from outside.
              for (const key of [
                'segmentId',
                'memberCount',
                'lastSyncedAt',
                'syncError',
              ] as const) {
                if (operation === 'update') {
                  data[key] = originalDoc?.[key]
                } else {
                  delete data[key]
                }
              }
              if (operation === 'create' || !originalDoc?.segmentId) {
                try {
                  const created = await runtime
                    .client()
                    .call('create segment', (r) => r.segments.create({ name: data.name }))
                  data.segmentId = created.id
                } catch (error) {
                  throw new APIError(
                    `Could not create the Resend segment: ${error instanceof Error ? error.message : String(error)}`,
                    502,
                    undefined,
                    true,
                  )
                }
              }
              return data
            },
          ],
        },
    labels: { plural: 'Lists', singular: 'List' },
  }
}
