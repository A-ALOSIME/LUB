CREATE TABLE "lub"."assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"storage_key" varchar(100) NOT NULL,
	"original_name" varchar(100) NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"visibility_code" varchar(20) DEFAULT 'Private' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "generated_asset_check" CHECK ("lub"."assets"."visibility_code"='Private' and "lub"."assets"."mime_type" in ('text/html','text/csv') and "lub"."assets"."size_bytes"=octet_length("lub"."assets"."body") and "lub"."assets"."size_bytes" between 1 and 2097152 and "lub"."assets"."checksum_sha256"=encode(sha256(convert_to("lub"."assets"."body",'UTF8')),'hex'))
);
--> statement-breakpoint
ALTER TABLE "lub"."assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"document_type_code" varchar(40) NOT NULL,
	"subject_user_id" uuid,
	"academic_term_id" uuid,
	"period_start" date,
	"period_end" date,
	"asset_id" uuid NOT NULL,
	"data_snapshot_json" jsonb NOT NULL,
	"template_snapshot_json" jsonb NOT NULL,
	"generated_by_user_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_code" varchar(20) DEFAULT 'Ready' NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "generated_documents_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "document_kind_check" CHECK ("lub"."generated_documents"."document_type_code" in ('Hours_Report','Hours_Certificate') and ("lub"."generated_documents"."document_type_code"='Hours_Certificate')=("lub"."generated_documents"."subject_user_id" is not null)),
	CONSTRAINT "document_state_check" CHECK ("lub"."generated_documents"."status_code" in ('Ready','Archived') and ("lub"."generated_documents"."status_code"='Archived')=("lub"."generated_documents"."archived_at" is not null) and ("lub"."generated_documents"."period_start" is null)=("lub"."generated_documents"."period_end" is null) and ("lub"."generated_documents"."period_start" is null or "lub"."generated_documents"."period_end">="lub"."generated_documents"."period_start"))
);
--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_code_check";--> statement-breakpoint
ALTER TABLE "lub"."assets" ADD CONSTRAINT "assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "generated_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "generated_documents_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "lub"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "generated_documents_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "generated_documents_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "lub"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "generated_documents_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "lub"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "generated_documents_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_org_time_idx" ON "lub"."generated_documents" USING btree ("organization_id","generated_at","id");--> statement-breakpoint
CREATE INDEX "document_subject_time_idx" ON "lub"."generated_documents" USING btree ("subject_user_id","generated_at","id");--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_code_check" CHECK ("lub"."permission_grants"."permission_code" in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE'));