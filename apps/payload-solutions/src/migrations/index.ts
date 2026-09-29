import * as migration_20260907_061634_initial from './20260907_061634_initial';
import * as migration_20260908_083000_emails_shipped from './20260908_083000_emails_shipped';
import * as migration_20260912_090000_plugins_shipped from './20260912_090000_plugins_shipped';
import * as migration_20260929_184546_consent_plugin from './20260929_184546_consent_plugin';
import * as migration_20260929_191625_contact_consent from './20260929_191625_contact_consent';

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
  {
    up: migration_20260912_090000_plugins_shipped.up,
    down: migration_20260912_090000_plugins_shipped.down,
    name: '20260912_090000_plugins_shipped',
  },
  {
    up: migration_20260929_184546_consent_plugin.up,
    down: migration_20260929_184546_consent_plugin.down,
    name: '20260929_184546_consent_plugin',
  },
  {
    up: migration_20260929_191625_contact_consent.up,
    down: migration_20260929_191625_contact_consent.down,
    name: '20260929_191625_contact_consent'
  },
];
