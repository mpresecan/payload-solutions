import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * "Payload Stack documentation" was still listed as in progress for Q3 2026 after Q3 ended.
 * The work carries into Q4, so the roadmap says so.
 *
 * The seed only runs on an empty collection, so existing databases keep the old quarter.
 * Guarded on the value it replaces, so a row an editor has already changed is left alone.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "roadmap_items" SET "quarter" = 'Q4 2026', "updated_at" = now()
    WHERE "title" = 'Payload Stack documentation' AND "stage" = 'in-progress' AND "quarter" = 'Q3 2026';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "roadmap_items" SET "quarter" = 'Q3 2026', "updated_at" = now()
    WHERE "title" = 'Payload Stack documentation' AND "stage" = 'in-progress' AND "quarter" = 'Q4 2026';
  `)
}
