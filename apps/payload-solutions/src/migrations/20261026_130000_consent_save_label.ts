import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload Consent stores the banner's "Save preferences" label as `savePreferences` instead of
 * `save`, which is a reserved Mongoose path and made MongoDB projects warn on boot. Rename the
 * column so the existing value carries over (a generated migration would drop and re-add it).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "consent_settings" RENAME COLUMN "banner_labels_save" TO "banner_labels_save_preferences";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "consent_settings" RENAME COLUMN "banner_labels_save_preferences" TO "banner_labels_save";
  `)
}
