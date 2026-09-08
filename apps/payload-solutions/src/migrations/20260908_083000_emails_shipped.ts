import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The catalogue seed only runs on an empty collection, so databases seeded before the Emails
 * plugin shipped still show it as planned. Correct those rows in place, leaving any row an
 * editor has already moved off the old seed values untouched.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "roadmap_items"
    SET "order" = "order" + 1
    WHERE "title" IN ('Payload Stack documentation', 'Payload Clock beta')
      AND "order" >= 2
      AND EXISTS (
        SELECT 1 FROM "roadmap_items" e
        WHERE e."title" = 'Payload Emails plugin' AND e."stage" = 'planned'
      );

    UPDATE "roadmap_items"
    SET "title" = 'Payload Emails plugin 0.1',
        "description" = 'Code-defined transactional emails with admin-editable copy, React Email templates, preview and test sends.',
        "stage" = 'shipped',
        "quarter" = 'Q3 2026',
        "order" = 2,
        "updated_at" = now()
    WHERE "title" = 'Payload Emails plugin' AND "stage" = 'planned';

    UPDATE "plugins"
    SET "summary" = 'Transactional emails defined in code, written by your team in the admin.',
        "description" = 'Declare each email once in TypeScript — the input callers pass, the variables editors may use, its default copy — and your team edits the subject and body in the admin, previews it with real sample data and sends itself a test. Rendered through your own React Email template and sent through the adapter you already configured, with every call site typed from generate:types.',
        "status" = 'available',
        "updated_at" = now()
    WHERE "slug" = 'payload-emails' AND "status" = 'planned';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "roadmap_items"
    SET "title" = 'Payload Emails plugin',
        "description" = 'Editable transactional email copy in the admin.',
        "stage" = 'planned',
        "quarter" = 'Q4 2026',
        "order" = 5,
        "updated_at" = now()
    WHERE "title" = 'Payload Emails plugin 0.1';

    UPDATE "roadmap_items"
    SET "order" = "order" - 1
    WHERE "title" IN ('Payload Stack documentation', 'Payload Clock beta')
      AND "order" >= 3;

    UPDATE "plugins"
    SET "summary" = 'Edit the copy of every automated email from the admin dashboard.',
        "description" = 'Verification, password reset, invitation and billing emails become documents your team can edit, preview and version in the Payload admin, with variables for names, links and organizations.',
        "status" = 'planned',
        "updated_at" = now()
    WHERE "slug" = 'payload-emails';
  `)
}
