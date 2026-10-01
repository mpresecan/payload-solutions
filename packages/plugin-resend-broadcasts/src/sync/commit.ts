import type { PayloadRequest } from 'payload'

/**
 * Hooks run before Payload commits the request's transaction, so work started from a hook in the
 * background must wait for the commit before it reads — or it would not see the document that
 * triggered it. Payload clears `req.transactionID` when it commits or rolls back.
 *
 * Adapters without transactions (SQLite by default) leave a Promise that resolved to nothing on
 * `req.transactionID` for the life of the request; there is nothing to wait for then.
 */
export async function waitForCommit(req: PayloadRequest, timeoutMs = 30_000): Promise<void> {
  const started = Date.now()
  while (req.transactionID && Date.now() - started < timeoutMs) {
    const current = req.transactionID
    if (current instanceof Promise && !(await current)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
