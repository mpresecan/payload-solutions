import * as migration_20260907_061634_initial from './20260907_061634_initial';
import * as migration_20260908_083000_emails_shipped from './20260908_083000_emails_shipped';
import * as migration_20260912_090000_plugins_shipped from './20260912_090000_plugins_shipped';
import * as migration_20260929_184546_consent_plugin from './20260929_184546_consent_plugin';
import * as migration_20260929_191625_contact_consent from './20260929_191625_contact_consent';
import * as migration_20261020_080228_payload_3_91 from './20261020_080228_payload_3_91';
import * as migration_20261026_080000_plugin_display_names from './20261026_080000_plugin_display_names';
import * as migration_20261026_110000_roadmap_docs_quarter from './20261026_110000_roadmap_docs_quarter';
import * as migration_20261026_120000_case_studies from './20261026_120000_case_studies';
import * as migration_20261026_121000_case_study_layron from './20261026_121000_case_study_layron';

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
    name: '20260929_191625_contact_consent',
  },
  {
    up: migration_20261020_080228_payload_3_91.up,
    down: migration_20261020_080228_payload_3_91.down,
    name: '20261020_080228_payload_3_91',
  },
  {
    up: migration_20261026_080000_plugin_display_names.up,
    down: migration_20261026_080000_plugin_display_names.down,
    name: '20261026_080000_plugin_display_names',
  },
  {
    up: migration_20261026_110000_roadmap_docs_quarter.up,
    down: migration_20261026_110000_roadmap_docs_quarter.down,
    name: '20261026_110000_roadmap_docs_quarter',
  },
  {
    up: migration_20261026_120000_case_studies.up,
    down: migration_20261026_120000_case_studies.down,
    name: '20261026_120000_case_studies',
  },
  {
    up: migration_20261026_121000_case_study_layron.up,
    down: migration_20261026_121000_case_study_layron.down,
    name: '20261026_121000_case_study_layron',
  },
];
