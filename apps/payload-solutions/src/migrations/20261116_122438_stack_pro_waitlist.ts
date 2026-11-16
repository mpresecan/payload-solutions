import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pro_waitlist_verticals" AS ENUM('ai-chat', 'marketplace', 'courses', 'feedback');
  CREATE TYPE "public"."enum_pro_waitlist_stage" AS ENUM('idea', 'building', 'live', 'agency');
  CREATE TYPE "public"."enum_pro_waitlist_status" AS ENUM('waiting', 'invited', 'customer', 'removed');
  CREATE TABLE "pro_waitlist_verticals" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_pro_waitlist_verticals",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pro_waitlist" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"other_vertical" varchar,
  	"stage" "enum_pro_waitlist_stage",
  	"building" varchar,
  	"source" varchar,
  	"consented_at" timestamp(3) with time zone,
  	"consent_policy_version" varchar,
  	"status" "enum_pro_waitlist_status" DEFAULT 'waiting',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pro_waitlist_id" integer;
  ALTER TABLE "pro_waitlist_verticals" ADD CONSTRAINT "pro_waitlist_verticals_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pro_waitlist"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pro_waitlist_verticals_order_idx" ON "pro_waitlist_verticals" USING btree ("order");
  CREATE INDEX "pro_waitlist_verticals_parent_idx" ON "pro_waitlist_verticals" USING btree ("parent_id");
  CREATE UNIQUE INDEX "pro_waitlist_email_idx" ON "pro_waitlist" USING btree ("email");
  CREATE INDEX "pro_waitlist_updated_at_idx" ON "pro_waitlist" USING btree ("updated_at");
  CREATE INDEX "pro_waitlist_created_at_idx" ON "pro_waitlist" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pro_waitlist_fk" FOREIGN KEY ("pro_waitlist_id") REFERENCES "public"."pro_waitlist"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pro_waitlist_id_idx" ON "payload_locked_documents_rels" USING btree ("pro_waitlist_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pro_waitlist_verticals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pro_waitlist" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pro_waitlist_verticals" CASCADE;
  DROP TABLE "pro_waitlist" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pro_waitlist_fk";
  
  DROP INDEX "payload_locked_documents_rels_pro_waitlist_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pro_waitlist_id";
  DROP TYPE "public"."enum_pro_waitlist_verticals";
  DROP TYPE "public"."enum_pro_waitlist_stage";
  DROP TYPE "public"."enum_pro_waitlist_status";`)
}
