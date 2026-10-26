import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_case_studies_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__case_studies_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "case_studies_outcomes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"source" varchar
  );
  
  CREATE TABLE "case_studies_built_with" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "case_studies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"client" varchar,
  	"client_url" varchar,
  	"published_at" timestamp(3) with time zone,
  	"featured" boolean DEFAULT false,
  	"summary" varchar,
  	"industry" varchar,
  	"location" varchar,
  	"engagement" varchar,
  	"author" varchar DEFAULT 'Michael Presecan',
  	"content" jsonb,
  	"quote_text" varchar,
  	"quote_author" varchar,
  	"quote_role" varchar,
  	"quote_source_url" varchar,
  	"cta_title" varchar,
  	"cta_body" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_case_studies_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_case_studies_v_version_outcomes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"source" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_case_studies_v_version_built_with" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_case_studies_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_client" varchar,
  	"version_client_url" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_featured" boolean DEFAULT false,
  	"version_summary" varchar,
  	"version_industry" varchar,
  	"version_location" varchar,
  	"version_engagement" varchar,
  	"version_author" varchar DEFAULT 'Michael Presecan',
  	"version_content" jsonb,
  	"version_quote_text" varchar,
  	"version_quote_author" varchar,
  	"version_quote_role" varchar,
  	"version_quote_source_url" varchar,
  	"version_cta_title" varchar,
  	"version_cta_body" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__case_studies_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "contact_submissions" ADD COLUMN "source" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "case_studies_id" integer;
  ALTER TABLE "case_studies_outcomes" ADD CONSTRAINT "case_studies_outcomes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_studies_built_with" ADD CONSTRAINT "case_studies_built_with_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_studies_v_version_outcomes" ADD CONSTRAINT "_case_studies_v_version_outcomes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_studies_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_studies_v_version_built_with" ADD CONSTRAINT "_case_studies_v_version_built_with_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_studies_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_studies_v" ADD CONSTRAINT "_case_studies_v_parent_id_case_studies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."case_studies"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "case_studies_outcomes_order_idx" ON "case_studies_outcomes" USING btree ("_order");
  CREATE INDEX "case_studies_outcomes_parent_id_idx" ON "case_studies_outcomes" USING btree ("_parent_id");
  CREATE INDEX "case_studies_built_with_order_idx" ON "case_studies_built_with" USING btree ("_order");
  CREATE INDEX "case_studies_built_with_parent_id_idx" ON "case_studies_built_with" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "case_studies_slug_idx" ON "case_studies" USING btree ("slug");
  CREATE INDEX "case_studies_updated_at_idx" ON "case_studies" USING btree ("updated_at");
  CREATE INDEX "case_studies_created_at_idx" ON "case_studies" USING btree ("created_at");
  CREATE INDEX "case_studies__status_idx" ON "case_studies" USING btree ("_status");
  CREATE INDEX "_case_studies_v_version_outcomes_order_idx" ON "_case_studies_v_version_outcomes" USING btree ("_order");
  CREATE INDEX "_case_studies_v_version_outcomes_parent_id_idx" ON "_case_studies_v_version_outcomes" USING btree ("_parent_id");
  CREATE INDEX "_case_studies_v_version_built_with_order_idx" ON "_case_studies_v_version_built_with" USING btree ("_order");
  CREATE INDEX "_case_studies_v_version_built_with_parent_id_idx" ON "_case_studies_v_version_built_with" USING btree ("_parent_id");
  CREATE INDEX "_case_studies_v_parent_idx" ON "_case_studies_v" USING btree ("parent_id");
  CREATE INDEX "_case_studies_v_version_version_slug_idx" ON "_case_studies_v" USING btree ("version_slug");
  CREATE INDEX "_case_studies_v_version_version_updated_at_idx" ON "_case_studies_v" USING btree ("version_updated_at");
  CREATE INDEX "_case_studies_v_version_version_created_at_idx" ON "_case_studies_v" USING btree ("version_created_at");
  CREATE INDEX "_case_studies_v_version_version__status_idx" ON "_case_studies_v" USING btree ("version__status");
  CREATE INDEX "_case_studies_v_created_at_idx" ON "_case_studies_v" USING btree ("created_at");
  CREATE INDEX "_case_studies_v_updated_at_idx" ON "_case_studies_v" USING btree ("updated_at");
  CREATE INDEX "_case_studies_v_latest_idx" ON "_case_studies_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_case_studies_fk" FOREIGN KEY ("case_studies_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_case_studies_id_idx" ON "payload_locked_documents_rels" USING btree ("case_studies_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "case_studies_outcomes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_studies_built_with" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "case_studies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_studies_v_version_outcomes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_studies_v_version_built_with" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_case_studies_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "case_studies_outcomes" CASCADE;
  DROP TABLE "case_studies_built_with" CASCADE;
  DROP TABLE "case_studies" CASCADE;
  DROP TABLE "_case_studies_v_version_outcomes" CASCADE;
  DROP TABLE "_case_studies_v_version_built_with" CASCADE;
  DROP TABLE "_case_studies_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_case_studies_fk";
  
  DROP INDEX "payload_locked_documents_rels_case_studies_id_idx";
  ALTER TABLE "contact_submissions" DROP COLUMN "source";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "case_studies_id";
  DROP TYPE "public"."enum_case_studies_status";
  DROP TYPE "public"."enum__case_studies_v_version_status";`)
}
