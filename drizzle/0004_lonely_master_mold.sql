CREATE TABLE "lub"."application_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(120) NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "application_asset_type_check" CHECK ("lub"."application_assets"."mime_type" in ('application/pdf','image/jpeg','image/png')),
	CONSTRAINT "application_asset_size_check" CHECK ("lub"."application_assets"."size_bytes" between 1 and 5242880),
	CONSTRAINT "application_asset_key_check" CHECK ("lub"."application_assets"."object_key" ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$')
);
--> statement-breakpoint
ALTER TABLE "lub"."application_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."application_internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_note_body_check" CHECK (length(trim("lub"."application_internal_notes"."body")) between 1 and 3000)
);
--> statement-breakpoint
ALTER TABLE "lub"."application_internal_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."application_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"message_type_code" varchar(20) DEFAULT 'Interview' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_message_body_check" CHECK (length(trim("lub"."application_messages"."body")) between 1 and 3000),
	CONSTRAINT "application_message_type_check" CHECK ("lub"."application_messages"."message_type_code"='Interview')
);
--> statement-breakpoint
ALTER TABLE "lub"."application_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."application_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"from_status_code" varchar(20),
	"to_status_code" varchar(20) NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"bulk_action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" varchar(80)
);
--> statement-breakpoint
ALTER TABLE "lub"."application_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."bulk_action_items" (
	"bulk_action_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"previous_status_code" varchar(20) NOT NULL,
	"new_status_code" varchar(20) NOT NULL,
	"created_membership_id" uuid,
	"undo_result_code" varchar(30),
	CONSTRAINT "bulk_action_items_bulk_action_id_application_id_pk" PRIMARY KEY("bulk_action_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "lub"."bulk_action_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."bulk_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"action_type_code" varchar(20) NOT NULL,
	"executed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone,
	"undone_by_user_id" uuid,
	CONSTRAINT "bulk_action_type_check" CHECK ("lub"."bulk_actions"."action_type_code" in ('Accepted','Rejected','Interview'))
);
--> statement-breakpoint
ALTER TABLE "lub"."bulk_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."committee_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"status_code" varchar(20) DEFAULT 'Active' NOT NULL,
	"start_date" date DEFAULT current_date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "committee_membership_status_check" CHECK ("lub"."committee_memberships"."status_code" in ('Active','Ended')),
	CONSTRAINT "committee_membership_dates_check" CHECK ("lub"."committee_memberships"."end_date" is null or "lub"."committee_memberships"."end_date">="lub"."committee_memberships"."start_date"),
	CONSTRAINT "committee_membership_end_check" CHECK ("lub"."committee_memberships"."status_code"<>'Ended' or "lub"."committee_memberships"."end_date" is not null)
);
--> statement-breakpoint
ALTER TABLE "lub"."committee_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."form_response_assets" (
	"form_response_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	CONSTRAINT "form_response_assets_form_response_id_asset_id_field_id_pk" PRIMARY KEY("form_response_id","asset_id","field_id")
);
--> statement-breakpoint
ALTER TABLE "lub"."form_response_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_version_id" uuid NOT NULL,
	"respondent_user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_answers_check" CHECK (jsonb_typeof("lub"."form_responses"."answers")='object' and octet_length("lub"."form_responses"."answers"::text)<=256000),
	CONSTRAINT "response_revision_check" CHECK ("lub"."form_responses"."revision">0)
);
--> statement-breakpoint
ALTER TABLE "lub"."form_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(120) NOT NULL,
	"purpose_code" varchar(20) DEFAULT 'Membership' NOT NULL,
	"source_template_id" uuid,
	"is_system_template" boolean DEFAULT false NOT NULL,
	"status_code" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_owner_check" CHECK ("lub"."form_templates"."is_system_template" = ("lub"."form_templates"."organization_id" is null)),
	CONSTRAINT "template_status_check" CHECK ("lub"."form_templates"."status_code" in ('Active','Archived')),
	CONSTRAINT "template_purpose_check" CHECK ("lub"."form_templates"."purpose_code" = 'Membership'),
	CONSTRAINT "template_name_check" CHECK (length(trim("lub"."form_templates"."name")) between 2 and 120)
);
--> statement-breakpoint
ALTER TABLE "lub"."form_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status_code" varchar(20) DEFAULT 'Draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_version_number_unique" UNIQUE("form_template_id","version_number"),
	CONSTRAINT "form_version_status_check" CHECK ("lub"."form_versions"."status_code" in ('Draft','Published','Retired')),
	CONSTRAINT "form_version_number_check" CHECK ("lub"."form_versions"."version_number">0 and "lub"."form_versions"."revision">0),
	CONSTRAINT "form_definition_size_check" CHECK (jsonb_typeof("lub"."form_versions"."definition")='object' and octet_length("lub"."form_versions"."definition"::text)<=128000)
);
--> statement-breakpoint
ALTER TABLE "lub"."form_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."membership_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_round_id" uuid NOT NULL,
	"applicant_user_id" uuid NOT NULL,
	"requested_committee_id" uuid,
	"form_response_id" uuid NOT NULL,
	"status_code" varchar(20) DEFAULT 'Submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"accepted_membership_id" uuid,
	CONSTRAINT "membership_applications_form_response_id_unique" UNIQUE("form_response_id"),
	CONSTRAINT "membership_applications_accepted_membership_id_unique" UNIQUE("accepted_membership_id"),
	CONSTRAINT "one_application_per_round" UNIQUE("registration_round_id","applicant_user_id"),
	CONSTRAINT "application_status_check" CHECK ("lub"."membership_applications"."status_code" in ('Submitted','Interview','Accepted','Rejected','Withdrawn')),
	CONSTRAINT "application_membership_check" CHECK (("lub"."membership_applications"."status_code"='Accepted')=("lub"."membership_applications"."accepted_membership_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."registration_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_template_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"status_code" varchar(20) DEFAULT 'Draft' NOT NULL,
	"allow_withdrawal" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_status_check" CHECK ("lub"."registration_rounds"."status_code" in ('Draft','Open','Closed','Archived')),
	CONSTRAINT "round_dates_check" CHECK ("lub"."registration_rounds"."closes_at">"lub"."registration_rounds"."opens_at"),
	CONSTRAINT "round_title_check" CHECK (length(trim("lub"."registration_rounds"."title")) between 2 and 120)
);
--> statement-breakpoint
ALTER TABLE "lub"."registration_rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_code_check";--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_scope_check";--> statement-breakpoint
ALTER TABLE "lub"."organization_memberships" ADD COLUMN "source_application_id" uuid;--> statement-breakpoint
ALTER TABLE "lub"."application_assets" ADD CONSTRAINT "application_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_internal_notes" ADD CONSTRAINT "application_internal_notes_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "lub"."membership_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_internal_notes" ADD CONSTRAINT "application_internal_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_messages" ADD CONSTRAINT "application_messages_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "lub"."membership_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_messages" ADD CONSTRAINT "application_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_status_history" ADD CONSTRAINT "application_status_history_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "lub"."membership_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_status_history" ADD CONSTRAINT "application_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."application_status_history" ADD CONSTRAINT "application_status_history_bulk_action_id_bulk_actions_id_fk" FOREIGN KEY ("bulk_action_id") REFERENCES "lub"."bulk_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."bulk_action_items" ADD CONSTRAINT "bulk_action_items_bulk_action_id_bulk_actions_id_fk" FOREIGN KEY ("bulk_action_id") REFERENCES "lub"."bulk_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."bulk_action_items" ADD CONSTRAINT "bulk_action_items_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "lub"."membership_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."bulk_action_items" ADD CONSTRAINT "bulk_action_items_created_membership_id_organization_memberships_id_fk" FOREIGN KEY ("created_membership_id") REFERENCES "lub"."organization_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."bulk_actions" ADD CONSTRAINT "bulk_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."bulk_actions" ADD CONSTRAINT "bulk_actions_executed_by_user_id_users_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."bulk_actions" ADD CONSTRAINT "bulk_actions_undone_by_user_id_users_id_fk" FOREIGN KEY ("undone_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."committee_memberships" ADD CONSTRAINT "committee_memberships_organization_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("organization_membership_id","organization_id") REFERENCES "lub"."organization_memberships"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_response_assets" ADD CONSTRAINT "form_response_assets_form_response_id_form_responses_id_fk" FOREIGN KEY ("form_response_id") REFERENCES "lub"."form_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_response_assets" ADD CONSTRAINT "form_response_assets_asset_id_application_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "lub"."application_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_responses" ADD CONSTRAINT "form_responses_form_version_id_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "lub"."form_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_responses" ADD CONSTRAINT "form_responses_respondent_user_id_users_id_fk" FOREIGN KEY ("respondent_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_templates" ADD CONSTRAINT "form_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_templates" ADD CONSTRAINT "form_templates_source_template_id_form_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "lub"."form_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."form_versions" ADD CONSTRAINT "form_versions_form_template_id_form_templates_id_fk" FOREIGN KEY ("form_template_id") REFERENCES "lub"."form_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ADD CONSTRAINT "membership_applications_registration_round_id_registration_rounds_id_fk" FOREIGN KEY ("registration_round_id") REFERENCES "lub"."registration_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ADD CONSTRAINT "membership_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ADD CONSTRAINT "membership_applications_requested_committee_id_committees_id_fk" FOREIGN KEY ("requested_committee_id") REFERENCES "lub"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ADD CONSTRAINT "membership_applications_form_response_id_form_responses_id_fk" FOREIGN KEY ("form_response_id") REFERENCES "lub"."form_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ADD CONSTRAINT "membership_applications_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_applications" ADD CONSTRAINT "membership_applications_accepted_membership_id_organization_memberships_id_fk" FOREIGN KEY ("accepted_membership_id") REFERENCES "lub"."organization_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."registration_rounds" ADD CONSTRAINT "registration_rounds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."registration_rounds" ADD CONSTRAINT "registration_rounds_form_template_id_form_templates_id_fk" FOREIGN KEY ("form_template_id") REFERENCES "lub"."form_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_asset_owner_idx" ON "lub"."application_assets" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "internal_note_application_idx" ON "lub"."application_internal_notes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "message_application_idx" ON "lub"."application_messages" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_history_time_idx" ON "lub"."application_status_history" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "bulk_org_time_idx" ON "lub"."bulk_actions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_committee_period_idx" ON "lub"."committee_memberships" USING btree ("organization_membership_id","committee_id") WHERE "lub"."committee_memberships"."status_code"='Active' and "lub"."committee_memberships"."end_date" is null;--> statement-breakpoint
CREATE INDEX "response_user_idx" ON "lub"."form_responses" USING btree ("respondent_user_id");--> statement-breakpoint
CREATE INDEX "template_org_idx" ON "lub"."form_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_form_draft_idx" ON "lub"."form_versions" USING btree ("form_template_id") WHERE "lub"."form_versions"."status_code"='Draft';--> statement-breakpoint
CREATE INDEX "application_round_status_idx" ON "lub"."membership_applications" USING btree ("registration_round_id","status_code");--> statement-breakpoint
CREATE INDEX "application_user_time_idx" ON "lub"."membership_applications" USING btree ("applicant_user_id","created_at");--> statement-breakpoint
CREATE INDEX "round_org_status_idx" ON "lub"."registration_rounds" USING btree ("organization_id","status_code");--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_code_check" CHECK ("lub"."permission_grants"."permission_code" in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT'));--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_scope_check" CHECK ("lub"."permission_grants"."committee_id" is null or "lub"."permission_grants"."permission_code" in ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION'));