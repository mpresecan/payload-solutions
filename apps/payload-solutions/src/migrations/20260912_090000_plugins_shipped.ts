import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Vercel Integration and Payload Action Scheduler shipped at 0.1 in Q3 2026, and Payload Stack
 * is at 0.4 — but the catalogue seed only runs on an empty collection, so every database
 * seeded before that still advertises them as planned for 2027.
 *
 * Every statement is guarded on the value it replaces, so a row an editor has already
 * corrected by hand is left alone and a database that is already right is untouched. The two
 * newly shipped roadmap items are moved to the end of the shipped run, which is the order the
 * log reads in (oldest release first in the data, newest first on the page).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Payload Stack has released three times since the roadmap item was written.
    UPDATE "roadmap_items"
    SET "title" = 'Payload Stack 0.4', "updated_at" = now()
    WHERE "title" = 'Payload Stack 0.1';

    -- Emails shipped in Q3; the same correction as 20260908_083000, for databases that were
    -- re-seeded after that migration ran.
    UPDATE "roadmap_items"
    SET "title" = 'Payload Emails plugin 0.1',
        "description" = 'Code-defined transactional emails with admin-editable copy, React Email templates, preview and test sends.',
        "stage" = 'shipped',
        "quarter" = 'Q3 2026',
        "updated_at" = now()
    WHERE "title" = 'Payload Emails plugin' AND "stage" = 'planned';

    UPDATE "roadmap_items"
    SET "title" = 'Vercel Integration plugin 0.1',
        "description" = 'Deploys from the admin or after content changes, build status, cancel and rollback.',
        "stage" = 'shipped',
        "quarter" = 'Q3 2026',
        "order" = (SELECT COALESCE(MAX("order"), 0) + 1 FROM "roadmap_items" WHERE "stage" = 'shipped'),
        "updated_at" = now()
    WHERE "title" = 'Vercel Integration plugin' AND "stage" = 'planned';

    UPDATE "roadmap_items"
    SET "title" = 'Payload Action Scheduler plugin 0.1',
        "description" = 'Scheduled and recurring actions on top of job queues, with an admin view.',
        "stage" = 'shipped',
        "quarter" = 'Q3 2026',
        "order" = (SELECT COALESCE(MAX("order"), 0) + 1 FROM "roadmap_items" WHERE "stage" = 'shipped'),
        "updated_at" = now()
    WHERE "title" = 'Payload Action Scheduler plugin' AND "stage" = 'planned';

    -- Deployed before 20260908_083000 ran: shipped, but still carrying the planned-era line.
    UPDATE "roadmap_items"
    SET "description" = 'Code-defined transactional emails with admin-editable copy, React Email templates, preview and test sends.',
        "updated_at" = now()
    WHERE "title" = 'Payload Emails plugin 0.1'
      AND "description" = 'Editable transactional email copy in the admin.';

    -- Titles typed with a trailing full stop.
    UPDATE "roadmap_items"
    SET "title" = rtrim("title", '.'), "updated_at" = now()
    WHERE "title" IN ('Vercel Integration plugin 0.1.', 'Payload Action Scheduler plugin 0.1.');

    -- The catalogue rows: status, and the planned-era copy that described an intention rather
    -- than what the plugin does.
    UPDATE "plugins"
    SET "summary" = 'Deploy to Vercel from the admin or after content changes, and follow every build.',
        "description" = 'Trigger Vercel deploy hooks from the Payload admin or automatically after content changes, see what is waiting to go live, follow every build, cancel and roll back — without giving editors a Vercel login.',
        "status" = 'available',
        "updated_at" = now()
    WHERE "slug" = 'vercel-integration'
      AND "summary" = 'Trigger Vercel deploy hooks from the admin and see deployment status.';

    UPDATE "plugins"
    SET "description" = 'Named, typed actions scheduled at runtime with arguments — once, as soon as possible, on an interval or on a cron — executed by the Payload job queue, recorded in a ledger and operated from an admin view: retry, cancel, run now.',
        "status" = 'available',
        "updated_at" = now()
    WHERE "slug" = 'payload-action-scheduler'
      AND "description" = 'Schedule one-off and recurring actions with arguments, groups and claims; inspect pending, running and failed actions in the admin, retry or cancel them.';

    UPDATE "plugins"
    SET "summary" = 'Transactional emails defined in code, written by your team in the admin.',
        "status" = 'available',
        "updated_at" = now()
    WHERE "slug" = 'payload-emails'
      AND "summary" = 'Edit the copy of every automated email from the admin dashboard.';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "roadmap_items"
    SET "title" = 'Payload Stack 0.1', "updated_at" = now()
    WHERE "title" = 'Payload Stack 0.4';

    UPDATE "roadmap_items"
    SET "title" = 'Vercel Integration plugin',
        "description" = 'Deploy hooks and deployment status in the admin.',
        "stage" = 'planned',
        "quarter" = 'Q1 2027',
        "updated_at" = now()
    WHERE "title" = 'Vercel Integration plugin 0.1';

    UPDATE "roadmap_items"
    SET "title" = 'Payload Action Scheduler plugin',
        "description" = 'Scheduled and recurring actions on top of job queues.',
        "stage" = 'planned',
        "quarter" = 'Q1 2027',
        "updated_at" = now()
    WHERE "title" = 'Payload Action Scheduler plugin 0.1';

    UPDATE "plugins"
    SET "summary" = 'Trigger Vercel deploy hooks from the admin and see deployment status.',
        "description" = 'A Deploy button and status view in the Payload admin, wired to Vercel build hooks, so content editors can publish static sites without touching Vercel.',
        "status" = 'planned',
        "updated_at" = now()
    WHERE "slug" = 'vercel-integration';

    UPDATE "plugins"
    SET "description" = 'Schedule one-off and recurring actions with arguments, groups and claims; inspect pending, running and failed actions in the admin, retry or cancel them.',
        "status" = 'planned',
        "updated_at" = now()
    WHERE "slug" = 'payload-action-scheduler';
  `)
}
