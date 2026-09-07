import type { Payload } from 'payload'

import { getCookieTableData } from '../server.js'
import { CookieTable, type CookieTableProps } from './CookieTable.js'

/** Async Server Component that loads its own data through the local API. */
export async function CookieTableFromPayload({
  payload,
  locale,
  ...props
}: { payload: Payload; locale?: string } & Omit<CookieTableProps, 'categories' | 'trackers'>) {
  const data = await getCookieTableData(payload, { locale })
  return <CookieTable {...data} {...props} />
}
