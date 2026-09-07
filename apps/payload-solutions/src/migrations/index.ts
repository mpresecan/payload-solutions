import * as migration_20260907_061634_initial from './20260907_061634_initial'

export const migrations = [
  {
    up: migration_20260907_061634_initial.up,
    down: migration_20260907_061634_initial.down,
    name: '20260907_061634_initial',
  },
]
