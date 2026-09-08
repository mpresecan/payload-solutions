import * as migration_20260907_061634_initial from './20260907_061634_initial'
import * as migration_20260908_083000_emails_shipped from './20260908_083000_emails_shipped'

export const migrations = [
  {
    up: migration_20260907_061634_initial.up,
    down: migration_20260907_061634_initial.down,
    name: '20260907_061634_initial',
  },
  {
    up: migration_20260908_083000_emails_shipped.up,
    down: migration_20260908_083000_emails_shipped.down,
    name: '20260908_083000_emails_shipped',
  },
]
