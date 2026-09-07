import type { Payload } from 'payload'

import { devUser } from './helpers/credentials.js'

/** Creates the dev admin user. The plugin seeds its own categories, trackers and legal pages. */
export const seed = async (payload: Payload) => {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: {
      email: {
        equals: devUser.email,
      },
    },
  })

  if (!totalDocs) {
    await payload.create({
      collection: 'users',
      data: devUser,
    })
  }
}
