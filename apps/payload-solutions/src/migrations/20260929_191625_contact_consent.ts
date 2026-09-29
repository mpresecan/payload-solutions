import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contact_submissions" ADD COLUMN "consented_at" timestamp(3) with time zone;
  ALTER TABLE "contact_submissions" ADD COLUMN "consent_policy_version" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contact_submissions" DROP COLUMN "consented_at";
  ALTER TABLE "contact_submissions" DROP COLUMN "consent_policy_version";`)
}
