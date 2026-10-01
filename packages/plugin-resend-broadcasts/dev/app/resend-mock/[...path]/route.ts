// The in-memory Resend the dev app talks to when RESEND_API_KEY is not set. Inspect it at
// /resend-mock/__mock/state; POST /resend-mock/__mock/contacts/<email>/unsubscribe plays a reader
// clicking the unsubscribe link and delivers the signed webhook back to this app.
import { getResendMock, MOCK_PREFIX } from '../../../resend-mock/start.js'

const handle = (request: Request) => getResendMock().handleRequest(request, MOCK_PREFIX)

export const DELETE = handle
export const GET = handle
export const PATCH = handle
export const POST = handle
