import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import type { Runtime } from '../runtime.js'
import type { SanitizedSource } from '../types.js'

import { SKIP_SYNC } from '../constants.js'
import { waitForCommit } from '../sync/commit.js'
import { removeDocument, syncDocument } from '../sync/document.js'

/**
 * Keeps Resend in step with a source collection. A failed Resend call is logged and never fails
 * the save: the document is the source of truth, and a resync repairs any drift.
 */
export function createSourceHooks(runtime: Runtime, source: SanitizedSource) {
  const afterChange: CollectionAfterChangeHook = async ({ context, doc, previousDoc, req }) => {
    if (context[SKIP_SYNC]) {
      return doc
    }
    const run = (withReq: boolean) =>
      syncDocument(
        {
          client: runtime.client(),
          options: runtime.options,
          payload: req.payload,
          req: withReq ? req : undefined,
        },
        source,
        doc,
        previousDoc,
      )
    await dispatch(runtime, req, `Sync ${source.collection} ${doc.id}`, run)
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = async ({ context, doc, req }) => {
    if (context[SKIP_SYNC]) {
      return doc
    }
    const run = (withReq: boolean) =>
      removeDocument(
        {
          client: runtime.client(),
          options: runtime.options,
          payload: req.payload,
          req: withReq ? req : undefined,
        },
        source,
        doc,
      )
    await dispatch(runtime, req, `Remove ${source.collection} ${doc.id}`, run)
    return doc
  }

  return { afterChange, afterDelete }
}

async function dispatch(
  runtime: Runtime,
  req: PayloadRequest,
  label: string,
  run: (withReq: boolean) => Promise<void>,
) {
  if (runtime.options.syncMode === 'background') {
    // Hooks run before Payload commits the transaction, so wait for the commit and then read
    // committed data — the request may be long finished by the time this runs.
    runtime.runInBackground(req.payload, label, async () => {
      await waitForCommit(req)
      await run(false)
    })
    return
  }
  try {
    await run(true)
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `[plugin-resend-broadcasts] ${label} failed; run a resync to repair.`,
    })
  }
}
