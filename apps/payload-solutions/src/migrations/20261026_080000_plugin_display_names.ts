import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The plugins no longer carry "Payload" as part of their own name: "Payload Consent" is
 * "Cookie Consent for Payload", "Payload Emails" is "Transactional Emails for Payload" and
 * "Payload Action Scheduler" is "Action Scheduler for Payload". Slugs, docs paths and package
 * names stay as they are.
 *
 * The seed only runs on an empty collection, so existing databases still show the old names.
 * Every statement is guarded on the value it replaces, so a row an editor has already changed
 * by hand is left alone.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "plugins" SET "name" = 'Cookie Consent for Payload', "updated_at" = now()
    WHERE "slug" = 'payload-consent' AND "name" = 'Payload Consent';

    UPDATE "plugins" SET "name" = 'Transactional Emails for Payload', "updated_at" = now()
    WHERE "slug" = 'payload-emails' AND "name" = 'Payload Emails';

    UPDATE "plugins" SET "name" = 'Action Scheduler for Payload', "updated_at" = now()
    WHERE "slug" = 'payload-action-scheduler' AND "name" = 'Payload Action Scheduler';

    UPDATE "roadmap_items" SET "title" = 'Cookie Consent plugin 0.1', "updated_at" = now()
    WHERE "title" = 'Payload Consent plugin 0.1';

    UPDATE "roadmap_items" SET "title" = 'Transactional Emails plugin 0.1', "updated_at" = now()
    WHERE "title" = 'Payload Emails plugin 0.1';

    UPDATE "roadmap_items" SET "title" = 'Action Scheduler plugin 0.1', "updated_at" = now()
    WHERE "title" = 'Payload Action Scheduler plugin 0.1';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "plugins" SET "name" = 'Payload Consent', "updated_at" = now()
    WHERE "slug" = 'payload-consent' AND "name" = 'Cookie Consent for Payload';

    UPDATE "plugins" SET "name" = 'Payload Emails', "updated_at" = now()
    WHERE "slug" = 'payload-emails' AND "name" = 'Transactional Emails for Payload';

    UPDATE "plugins" SET "name" = 'Payload Action Scheduler', "updated_at" = now()
    WHERE "slug" = 'payload-action-scheduler' AND "name" = 'Action Scheduler for Payload';

    UPDATE "roadmap_items" SET "title" = 'Payload Consent plugin 0.1', "updated_at" = now()
    WHERE "title" = 'Cookie Consent plugin 0.1';

    UPDATE "roadmap_items" SET "title" = 'Payload Emails plugin 0.1', "updated_at" = now()
    WHERE "title" = 'Transactional Emails plugin 0.1';

    UPDATE "roadmap_items" SET "title" = 'Payload Action Scheduler plugin 0.1', "updated_at" = now()
    WHERE "title" = 'Action Scheduler plugin 0.1';
  `)
}
