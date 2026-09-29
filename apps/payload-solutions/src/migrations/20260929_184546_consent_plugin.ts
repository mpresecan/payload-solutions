import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_consent_categories_consent_mode_signals" AS ENUM('analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization', 'functionality_storage', 'personalization_storage', 'security_storage');
  CREATE TYPE "public"."enum_consent_trackers_cookies_storage" AS ENUM('cookie', 'localStorage', 'sessionStorage', 'indexedDB');
  CREATE TYPE "public"."enum_consent_trackers_environments" AS ENUM('development', 'production');
  CREATE TYPE "public"."enum_consent_trackers_kind" AS ENUM('script', 'pixel', 'iframe', 'sdk', 'cookie-only');
  CREATE TYPE "public"."enum_consent_trackers_loader_strategy" AS ENUM('afterDecision', 'lazy');
  CREATE TYPE "public"."enum_consent_records_source" AS ENUM('banner', 'preferences', 'api', 'gpc', 'withdraw', 'implicit');
  CREATE TYPE "public"."enum_consent_records_model" AS ENUM('opt-in', 'opt-out', 'notice', 'none');
  CREATE TYPE "public"."enum_legal_pages_kind" AS ENUM('privacy', 'terms', 'cookies', 'subprocessors', 'dpa', 'other');
  CREATE TYPE "public"."enum_legal_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__legal_pages_v_version_kind" AS ENUM('privacy', 'terms', 'cookies', 'subprocessors', 'dpa', 'other');
  CREATE TYPE "public"."enum__legal_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_consent_processors_data_categories" AS ENUM('account', 'contact', 'billing', 'content', 'usage', 'technical', 'support', 'marketing', 'special');
  CREATE TYPE "public"."enum_consent_processors_role" AS ENUM('processor', 'sub-processor', 'independent-controller', 'joint-controller');
  CREATE TYPE "public"."enum_consent_processors_transfer_mechanism" AS ENUM('none', 'adequacy', 'dpf', 'scc', 'bcr', 'derogation');
  CREATE TYPE "public"."enum_consent_processors_transfer_fallback" AS ENUM('scc', 'bcr');
  CREATE TYPE "public"."enum_consent_processors_status" AS ENUM('active', 'removed');
  CREATE TYPE "public"."enum_consent_audits_findings_severity" AS ENUM('blocker', 'warn', 'info');
  CREATE TYPE "public"."enum_consent_audits_findings_source" AS ENUM('deterministic', 'inferred');
  CREATE TYPE "public"."enum_consent_audits_findings_status" AS ENUM('open', 'accepted', 'fixed');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'consentPurgeRecords');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'consentPurgeRecords');
  CREATE TYPE "public"."enum_consent_settings_reconsent_on" AS ENUM('documents', 'categories', 'trackers');
  CREATE TYPE "public"."enum_consent_settings_jurisdiction_overrides_model" AS ENUM('opt-in', 'opt-out', 'notice', 'none');
  CREATE TYPE "public"."enum_consent_settings_compliance_legal_bases_basis" AS ENUM('consent', 'contract', 'legal-obligation', 'vital-interests', 'public-task', 'legitimate-interests');
  CREATE TYPE "public"."enum_consent_settings_recording_mode" AS ENUM('none', 'anonymous', 'linked');
  CREATE TYPE "public"."enum_consent_settings_jurisdiction_resolution" AS ENUM('header', 'manual', 'none');
  CREATE TYPE "public"."enum_consent_settings_jurisdiction_fallback" AS ENUM('opt-in', 'opt-out', 'notice', 'none');
  CREATE TYPE "public"."enum_consent_settings_banner_position" AS ENUM('bottom', 'bottom-left', 'bottom-right', 'center');
  CREATE TYPE "public"."enum_consent_settings_consent_mode_enabled" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_consent_settings_compliance_dpo_required" AS ENUM('yes', 'no', 'unknown');
  CREATE TYPE "public"."enum_consent_settings_compliance_audience" AS ENUM('b2b', 'b2c', 'both');
  CREATE TYPE "public"."enum_consent_settings_compliance_role" AS ENUM('controller', 'processor', 'both');
  CREATE TYPE "public"."enum_consent_settings_compliance_automated_decisions" AS ENUM('none', 'profiling', 'adm');
  CREATE TABLE "consent_categories_consent_mode_signals" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_consent_categories_consent_mode_signals",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "consent_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"order" numeric DEFAULT 0,
  	"label" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"required" boolean DEFAULT false,
  	"respect_g_p_c" boolean DEFAULT true,
  	"default_in_opt_out" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_trackers_cookies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"domain" varchar,
  	"storage" "enum_consent_trackers_cookies_storage" DEFAULT 'cookie',
  	"duration_text" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "consent_trackers_environments" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_consent_trackers_environments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "consent_trackers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"vendor" varchar,
  	"category_id" integer NOT NULL,
  	"kind" "enum_consent_trackers_kind" DEFAULT 'script' NOT NULL,
  	"purpose" varchar,
  	"vendor_privacy_url" varchar,
  	"loader_src" varchar,
  	"loader_inline_code" varchar,
  	"loader_strategy" "enum_consent_trackers_loader_strategy" DEFAULT 'afterDecision',
  	"loader_consent_mode_managed" boolean DEFAULT false,
  	"loader_attributes" jsonb,
  	"enabled" boolean DEFAULT true,
  	"preset_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"consent_id" varchar NOT NULL,
  	"user_id" integer,
  	"decisions" jsonb NOT NULL,
  	"source" "enum_consent_records_source" NOT NULL,
  	"country" varchar,
  	"model" "enum_consent_records_model",
  	"locale" varchar,
  	"versions_policy_version" varchar,
  	"versions_categories_version" varchar,
  	"versions_trackers_version" varchar,
  	"versions_documents_version" varchar,
  	"user_agent_family" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_records_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "legal_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"kind" "enum_legal_pages_kind" DEFAULT 'other',
  	"effective_date" timestamp(3) with time zone,
  	"show_in_footer" boolean DEFAULT true,
  	"content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_legal_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_legal_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_kind" "enum__legal_pages_v_version_kind" DEFAULT 'other',
  	"version_effective_date" timestamp(3) with time zone,
  	"version_show_in_footer" boolean DEFAULT true,
  	"version_content" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__legal_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "consent_processors_data_categories" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_consent_processors_data_categories",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "consent_processors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"legal_name" varchar,
  	"role" "enum_consent_processors_role" DEFAULT 'processor' NOT NULL,
  	"country" varchar NOT NULL,
  	"purpose" varchar NOT NULL,
  	"transfer_mechanism" "enum_consent_processors_transfer_mechanism" DEFAULT 'scc' NOT NULL,
  	"transfer_fallback" "enum_consent_processors_transfer_fallback",
  	"transfer_notes" varchar,
  	"privacy_url" varchar,
  	"dpa_url" varchar,
  	"subprocessors_url" varchar,
  	"subprocessor" boolean DEFAULT true,
  	"show_in_privacy_policy" boolean DEFAULT true,
  	"verified" boolean DEFAULT false,
  	"status" "enum_consent_processors_status" DEFAULT 'active' NOT NULL,
  	"added_at" timestamp(3) with time zone,
  	"removed_at" timestamp(3) with time zone,
  	"tracker_id" integer,
  	"preset_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_audits_findings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"finding_id" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"severity" "enum_consent_audits_findings_severity" NOT NULL,
  	"source" "enum_consent_audits_findings_source" DEFAULT 'deterministic' NOT NULL,
  	"locale" varchar,
  	"confidence" numeric,
  	"title" varchar NOT NULL,
  	"detail" varchar,
  	"quote" varchar,
  	"evidence" varchar,
  	"fix" varchar,
  	"page_id" integer,
  	"status" "enum_consent_audits_findings_status" DEFAULT 'open' NOT NULL,
  	"decided_at" timestamp(3) with time zone,
  	"decided_by_id" integer,
  	"reason" varchar
  );
  
  CREATE TABLE "consent_audits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"run_at" timestamp(3) with time zone NOT NULL,
  	"agent" varchar,
  	"model" varchar,
  	"tool_version" varchar,
  	"blockers" numeric DEFAULT 0,
  	"warnings" numeric DEFAULT 0,
  	"notices" numeric DEFAULT 0,
  	"accepted" numeric DEFAULT 0,
  	"scope" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_settings_reconsent_on" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_consent_settings_reconsent_on",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "consent_settings_jurisdiction_overrides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"region" varchar NOT NULL,
  	"model" "enum_consent_settings_jurisdiction_overrides_model" NOT NULL
  );
  
  CREATE TABLE "consent_settings_compliance_legal_bases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"purpose" varchar,
  	"basis" "enum_consent_settings_compliance_legal_bases_basis",
  	"notes" varchar
  );
  
  CREATE TABLE "consent_settings_compliance_retention" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"purpose" varchar,
  	"period" varchar
  );
  
  CREATE TABLE "consent_settings_compliance_answers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"answered_at" timestamp(3) with time zone,
  	"answered_by_user_id" integer,
  	"question" varchar,
  	"answer" varchar NOT NULL,
  	"answered_by" varchar
  );
  
  CREATE TABLE "consent_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"expires_after_months" numeric DEFAULT 6,
  	"recording_mode" "enum_consent_settings_recording_mode" DEFAULT 'anonymous',
  	"recording_retention_months" numeric DEFAULT 36,
  	"jurisdiction_resolution" "enum_consent_settings_jurisdiction_resolution" DEFAULT 'header',
  	"jurisdiction_fixed" varchar,
  	"jurisdiction_fallback" "enum_consent_settings_jurisdiction_fallback" DEFAULT 'opt-in',
  	"banner_title" varchar DEFAULT 'Your privacy choices',
  	"banner_description" varchar DEFAULT 'We use cookies and similar technologies. Necessary ones keep the site working; the rest only run with your consent. You can change your choice at any time.',
  	"banner_position" "enum_consent_settings_banner_position" DEFAULT 'bottom-left',
  	"banner_show_reject_all" boolean DEFAULT true,
  	"banner_labels_accept_all" varchar DEFAULT 'Accept all',
  	"banner_labels_reject_all" varchar DEFAULT 'Reject all',
  	"banner_labels_customize" varchar DEFAULT 'Customize',
  	"banner_labels_save" varchar DEFAULT 'Save preferences',
  	"banner_labels_close" varchar DEFAULT 'Close',
  	"banner_labels_manage" varchar DEFAULT 'Cookie settings',
  	"banner_labels_required_badge" varchar DEFAULT 'Always on',
  	"banner_labels_reload_notice" varchar DEFAULT 'Some services were switched off. Reload the page to apply your choice fully.',
  	"banner_privacy_page_id" integer,
  	"banner_cookie_page_id" integer,
  	"consent_mode_enabled" "enum_consent_settings_consent_mode_enabled" DEFAULT 'auto',
  	"consent_mode_ads_data_redaction" boolean DEFAULT true,
  	"consent_mode_url_passthrough" boolean DEFAULT false,
  	"consent_mode_wait_for_update_ms" numeric DEFAULT 500,
  	"processors_notice_days" numeric DEFAULT 30,
  	"processors_notice_email" varchar,
  	"processors_subscribe_url" varchar,
  	"processors_subprocessors_version" varchar,
  	"processors_changed_at" timestamp(3) with time zone,
  	"compliance_legal_name" varchar,
  	"compliance_trading_name" varchar,
  	"compliance_address" varchar,
  	"compliance_contact_email" varchar,
  	"compliance_dsr_email" varchar,
  	"compliance_website_url" varchar,
  	"compliance_establishment_country" varchar,
  	"compliance_supervisory_authority" varchar,
  	"compliance_governing_law" varchar,
  	"compliance_dpo_required" "enum_consent_settings_compliance_dpo_required" DEFAULT 'unknown',
  	"compliance_dpo_name" varchar,
  	"compliance_dpo_email" varchar,
  	"compliance_audience" "enum_consent_settings_compliance_audience",
  	"compliance_role" "enum_consent_settings_compliance_role",
  	"compliance_automated_decisions" "enum_consent_settings_compliance_automated_decisions",
  	"compliance_offers_to_e_e_a" boolean DEFAULT true,
  	"compliance_offers_to_u_k" boolean DEFAULT false,
  	"compliance_us_states" varchar,
  	"compliance_confirmed_at" timestamp(3) with time zone,
  	"versions_policy_version" varchar,
  	"versions_categories_version" varchar,
  	"versions_trackers_version" varchar,
  	"versions_documents_version" varchar,
  	"versions_bumped_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_categories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_trackers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_records_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_processors_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_audits_id" integer;
  ALTER TABLE "consent_categories_consent_mode_signals" ADD CONSTRAINT "consent_categories_consent_mode_signals_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_trackers_cookies" ADD CONSTRAINT "consent_trackers_cookies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."consent_trackers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_trackers_environments" ADD CONSTRAINT "consent_trackers_environments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_trackers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_trackers" ADD CONSTRAINT "consent_trackers_category_id_consent_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."consent_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_records_texts" ADD CONSTRAINT "consent_records_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_parent_id_legal_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_processors_data_categories" ADD CONSTRAINT "consent_processors_data_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_processors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_processors" ADD CONSTRAINT "consent_processors_tracker_id_consent_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."consent_trackers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_audits_findings" ADD CONSTRAINT "consent_audits_findings_page_id_legal_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."legal_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_audits_findings" ADD CONSTRAINT "consent_audits_findings_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_audits_findings" ADD CONSTRAINT "consent_audits_findings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."consent_audits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_settings_reconsent_on" ADD CONSTRAINT "consent_settings_reconsent_on_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_settings_jurisdiction_overrides" ADD CONSTRAINT "consent_settings_jurisdiction_overrides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_settings_compliance_legal_bases" ADD CONSTRAINT "consent_settings_compliance_legal_bases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_settings_compliance_retention" ADD CONSTRAINT "consent_settings_compliance_retention_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_settings_compliance_answers" ADD CONSTRAINT "consent_settings_compliance_answers_answered_by_user_id_users_id_fk" FOREIGN KEY ("answered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_settings_compliance_answers" ADD CONSTRAINT "consent_settings_compliance_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_settings" ADD CONSTRAINT "consent_settings_banner_privacy_page_id_legal_pages_id_fk" FOREIGN KEY ("banner_privacy_page_id") REFERENCES "public"."legal_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_settings" ADD CONSTRAINT "consent_settings_banner_cookie_page_id_legal_pages_id_fk" FOREIGN KEY ("banner_cookie_page_id") REFERENCES "public"."legal_pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "consent_categories_consent_mode_signals_order_idx" ON "consent_categories_consent_mode_signals" USING btree ("order");
  CREATE INDEX "consent_categories_consent_mode_signals_parent_idx" ON "consent_categories_consent_mode_signals" USING btree ("parent_id");
  CREATE UNIQUE INDEX "consent_categories_key_idx" ON "consent_categories" USING btree ("key");
  CREATE INDEX "consent_categories_updated_at_idx" ON "consent_categories" USING btree ("updated_at");
  CREATE INDEX "consent_categories_created_at_idx" ON "consent_categories" USING btree ("created_at");
  CREATE INDEX "consent_trackers_cookies_order_idx" ON "consent_trackers_cookies" USING btree ("_order");
  CREATE INDEX "consent_trackers_cookies_parent_id_idx" ON "consent_trackers_cookies" USING btree ("_parent_id");
  CREATE INDEX "consent_trackers_environments_order_idx" ON "consent_trackers_environments" USING btree ("order");
  CREATE INDEX "consent_trackers_environments_parent_idx" ON "consent_trackers_environments" USING btree ("parent_id");
  CREATE INDEX "consent_trackers_category_idx" ON "consent_trackers" USING btree ("category_id");
  CREATE INDEX "consent_trackers_preset_key_idx" ON "consent_trackers" USING btree ("preset_key");
  CREATE INDEX "consent_trackers_updated_at_idx" ON "consent_trackers" USING btree ("updated_at");
  CREATE INDEX "consent_trackers_created_at_idx" ON "consent_trackers" USING btree ("created_at");
  CREATE INDEX "consent_records_consent_id_idx" ON "consent_records" USING btree ("consent_id");
  CREATE INDEX "consent_records_user_idx" ON "consent_records" USING btree ("user_id");
  CREATE INDEX "consent_records_expires_at_idx" ON "consent_records" USING btree ("expires_at");
  CREATE INDEX "consent_records_updated_at_idx" ON "consent_records" USING btree ("updated_at");
  CREATE INDEX "consent_records_created_at_idx" ON "consent_records" USING btree ("created_at");
  CREATE INDEX "consent_records_texts_order_parent" ON "consent_records_texts" USING btree ("order","parent_id");
  CREATE INDEX "consent_records_texts_text_idx" ON "consent_records_texts" USING btree ("text");
  CREATE UNIQUE INDEX "legal_pages_slug_idx" ON "legal_pages" USING btree ("slug");
  CREATE INDEX "legal_pages_updated_at_idx" ON "legal_pages" USING btree ("updated_at");
  CREATE INDEX "legal_pages_created_at_idx" ON "legal_pages" USING btree ("created_at");
  CREATE INDEX "legal_pages__status_idx" ON "legal_pages" USING btree ("_status");
  CREATE INDEX "_legal_pages_v_parent_idx" ON "_legal_pages_v" USING btree ("parent_id");
  CREATE INDEX "_legal_pages_v_version_version_slug_idx" ON "_legal_pages_v" USING btree ("version_slug");
  CREATE INDEX "_legal_pages_v_version_version_updated_at_idx" ON "_legal_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_legal_pages_v_version_version_created_at_idx" ON "_legal_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_legal_pages_v_version_version__status_idx" ON "_legal_pages_v" USING btree ("version__status");
  CREATE INDEX "_legal_pages_v_created_at_idx" ON "_legal_pages_v" USING btree ("created_at");
  CREATE INDEX "_legal_pages_v_updated_at_idx" ON "_legal_pages_v" USING btree ("updated_at");
  CREATE INDEX "_legal_pages_v_latest_idx" ON "_legal_pages_v" USING btree ("latest");
  CREATE INDEX "consent_processors_data_categories_order_idx" ON "consent_processors_data_categories" USING btree ("order");
  CREATE INDEX "consent_processors_data_categories_parent_idx" ON "consent_processors_data_categories" USING btree ("parent_id");
  CREATE INDEX "consent_processors_tracker_idx" ON "consent_processors" USING btree ("tracker_id");
  CREATE INDEX "consent_processors_preset_key_idx" ON "consent_processors" USING btree ("preset_key");
  CREATE INDEX "consent_processors_updated_at_idx" ON "consent_processors" USING btree ("updated_at");
  CREATE INDEX "consent_processors_created_at_idx" ON "consent_processors" USING btree ("created_at");
  CREATE INDEX "consent_audits_findings_order_idx" ON "consent_audits_findings" USING btree ("_order");
  CREATE INDEX "consent_audits_findings_parent_id_idx" ON "consent_audits_findings" USING btree ("_parent_id");
  CREATE INDEX "consent_audits_findings_finding_id_idx" ON "consent_audits_findings" USING btree ("finding_id");
  CREATE INDEX "consent_audits_findings_page_idx" ON "consent_audits_findings" USING btree ("page_id");
  CREATE INDEX "consent_audits_findings_decided_by_idx" ON "consent_audits_findings" USING btree ("decided_by_id");
  CREATE INDEX "consent_audits_updated_at_idx" ON "consent_audits" USING btree ("updated_at");
  CREATE INDEX "consent_audits_created_at_idx" ON "consent_audits" USING btree ("created_at");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "consent_settings_reconsent_on_order_idx" ON "consent_settings_reconsent_on" USING btree ("order");
  CREATE INDEX "consent_settings_reconsent_on_parent_idx" ON "consent_settings_reconsent_on" USING btree ("parent_id");
  CREATE INDEX "consent_settings_jurisdiction_overrides_order_idx" ON "consent_settings_jurisdiction_overrides" USING btree ("_order");
  CREATE INDEX "consent_settings_jurisdiction_overrides_parent_id_idx" ON "consent_settings_jurisdiction_overrides" USING btree ("_parent_id");
  CREATE INDEX "consent_settings_compliance_legal_bases_order_idx" ON "consent_settings_compliance_legal_bases" USING btree ("_order");
  CREATE INDEX "consent_settings_compliance_legal_bases_parent_id_idx" ON "consent_settings_compliance_legal_bases" USING btree ("_parent_id");
  CREATE INDEX "consent_settings_compliance_retention_order_idx" ON "consent_settings_compliance_retention" USING btree ("_order");
  CREATE INDEX "consent_settings_compliance_retention_parent_id_idx" ON "consent_settings_compliance_retention" USING btree ("_parent_id");
  CREATE INDEX "consent_settings_compliance_answers_order_idx" ON "consent_settings_compliance_answers" USING btree ("_order");
  CREATE INDEX "consent_settings_compliance_answers_parent_id_idx" ON "consent_settings_compliance_answers" USING btree ("_parent_id");
  CREATE INDEX "consent_settings_compliance_answers_answered_by_user_idx" ON "consent_settings_compliance_answers" USING btree ("answered_by_user_id");
  CREATE INDEX "consent_settings_banner_banner_privacy_page_idx" ON "consent_settings" USING btree ("banner_privacy_page_id");
  CREATE INDEX "consent_settings_banner_banner_cookie_page_idx" ON "consent_settings" USING btree ("banner_cookie_page_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_categories_fk" FOREIGN KEY ("consent_categories_id") REFERENCES "public"."consent_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_trackers_fk" FOREIGN KEY ("consent_trackers_id") REFERENCES "public"."consent_trackers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_records_fk" FOREIGN KEY ("consent_records_id") REFERENCES "public"."consent_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_processors_fk" FOREIGN KEY ("consent_processors_id") REFERENCES "public"."consent_processors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_audits_fk" FOREIGN KEY ("consent_audits_id") REFERENCES "public"."consent_audits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_consent_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_categories_id");
  CREATE INDEX "payload_locked_documents_rels_consent_trackers_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_trackers_id");
  CREATE INDEX "payload_locked_documents_rels_consent_records_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_records_id");
  CREATE INDEX "payload_locked_documents_rels_legal_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_pages_id");
  CREATE INDEX "payload_locked_documents_rels_consent_processors_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_processors_id");
  CREATE INDEX "payload_locked_documents_rels_consent_audits_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_audits_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "consent_categories_consent_mode_signals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_trackers_cookies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_trackers_environments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_trackers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_records" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_records_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_processors_data_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_processors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_audits_findings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_audits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_settings_reconsent_on" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_settings_jurisdiction_overrides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_settings_compliance_legal_bases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_settings_compliance_retention" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_settings_compliance_answers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "consent_categories_consent_mode_signals" CASCADE;
  DROP TABLE "consent_categories" CASCADE;
  DROP TABLE "consent_trackers_cookies" CASCADE;
  DROP TABLE "consent_trackers_environments" CASCADE;
  DROP TABLE "consent_trackers" CASCADE;
  DROP TABLE "consent_records" CASCADE;
  DROP TABLE "consent_records_texts" CASCADE;
  DROP TABLE "legal_pages" CASCADE;
  DROP TABLE "_legal_pages_v" CASCADE;
  DROP TABLE "consent_processors_data_categories" CASCADE;
  DROP TABLE "consent_processors" CASCADE;
  DROP TABLE "consent_audits_findings" CASCADE;
  DROP TABLE "consent_audits" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "consent_settings_reconsent_on" CASCADE;
  DROP TABLE "consent_settings_jurisdiction_overrides" CASCADE;
  DROP TABLE "consent_settings_compliance_legal_bases" CASCADE;
  DROP TABLE "consent_settings_compliance_retention" CASCADE;
  DROP TABLE "consent_settings_compliance_answers" CASCADE;
  DROP TABLE "consent_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_categories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_trackers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_records_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_processors_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_audits_fk";
  
  DROP INDEX "payload_locked_documents_rels_consent_categories_id_idx";
  DROP INDEX "payload_locked_documents_rels_consent_trackers_id_idx";
  DROP INDEX "payload_locked_documents_rels_consent_records_id_idx";
  DROP INDEX "payload_locked_documents_rels_legal_pages_id_idx";
  DROP INDEX "payload_locked_documents_rels_consent_processors_id_idx";
  DROP INDEX "payload_locked_documents_rels_consent_audits_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_categories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_trackers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_processors_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_audits_id";
  DROP TYPE "public"."enum_consent_categories_consent_mode_signals";
  DROP TYPE "public"."enum_consent_trackers_cookies_storage";
  DROP TYPE "public"."enum_consent_trackers_environments";
  DROP TYPE "public"."enum_consent_trackers_kind";
  DROP TYPE "public"."enum_consent_trackers_loader_strategy";
  DROP TYPE "public"."enum_consent_records_source";
  DROP TYPE "public"."enum_consent_records_model";
  DROP TYPE "public"."enum_legal_pages_kind";
  DROP TYPE "public"."enum_legal_pages_status";
  DROP TYPE "public"."enum__legal_pages_v_version_kind";
  DROP TYPE "public"."enum__legal_pages_v_version_status";
  DROP TYPE "public"."enum_consent_processors_data_categories";
  DROP TYPE "public"."enum_consent_processors_role";
  DROP TYPE "public"."enum_consent_processors_transfer_mechanism";
  DROP TYPE "public"."enum_consent_processors_transfer_fallback";
  DROP TYPE "public"."enum_consent_processors_status";
  DROP TYPE "public"."enum_consent_audits_findings_severity";
  DROP TYPE "public"."enum_consent_audits_findings_source";
  DROP TYPE "public"."enum_consent_audits_findings_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_consent_settings_reconsent_on";
  DROP TYPE "public"."enum_consent_settings_jurisdiction_overrides_model";
  DROP TYPE "public"."enum_consent_settings_compliance_legal_bases_basis";
  DROP TYPE "public"."enum_consent_settings_recording_mode";
  DROP TYPE "public"."enum_consent_settings_jurisdiction_resolution";
  DROP TYPE "public"."enum_consent_settings_jurisdiction_fallback";
  DROP TYPE "public"."enum_consent_settings_banner_position";
  DROP TYPE "public"."enum_consent_settings_consent_mode_enabled";
  DROP TYPE "public"."enum_consent_settings_compliance_dpo_required";
  DROP TYPE "public"."enum_consent_settings_compliance_audience";
  DROP TYPE "public"."enum_consent_settings_compliance_role";
  DROP TYPE "public"."enum_consent_settings_compliance_automated_decisions";`)
}
