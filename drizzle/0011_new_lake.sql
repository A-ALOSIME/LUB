CREATE TABLE "lub"."academic_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year" varchar(20) NOT NULL,
	"term_code" varchar(20) NOT NULL,
	"name_ar" varchar(120) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "academic_term_identity_unique" UNIQUE("academic_year","term_code"),
	CONSTRAINT "academic_term_bounds_check" CHECK ("lub"."academic_terms"."end_date">="lub"."academic_terms"."start_date" and length(trim("lub"."academic_terms"."name_ar")) between 2 and 120 and length(trim("lub"."academic_terms"."academic_year")) between 2 and 20 and length(trim("lub"."academic_terms"."term_code")) between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "lub"."academic_terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."hour_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"committee_id" uuid,
	"academic_term_id" uuid NOT NULL,
	"source_code" varchar(20) NOT NULL,
	"task_participant_id" uuid,
	"hours" numeric(6, 2) NOT NULL,
	"activity_date" date NOT NULL,
	"description" text NOT NULL,
	"status_code" varchar(20) NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hour_task_participation_unique" UNIQUE("task_participant_id"),
	CONSTRAINT "hour_record_bounds_check" CHECK ("lub"."hour_records"."hours" between 0 and 1000 and length(trim("lub"."hour_records"."description")) between 1 and 3000),
	CONSTRAINT "hour_record_source_check" CHECK ("lub"."hour_records"."source_code" in ('TASK','MANUAL','SELF_REPORTED') and ("lub"."hour_records"."source_code"='TASK')=("lub"."hour_records"."task_participant_id" is not null)),
	CONSTRAINT "hour_record_state_check" CHECK ("lub"."hour_records"."status_code" in ('Pending','Approved','Rejected','Voided') and ("lub"."hour_records"."status_code"='Pending')=("lub"."hour_records"."reviewed_at" is null) and ("lub"."hour_records"."reviewed_at" is null)=("lub"."hour_records"."reviewed_by_user_id" is null) and ("lub"."hour_records"."status_code" not in ('Rejected','Voided') or length(trim("lub"."hour_records"."review_note"))>0))
);
--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."hour_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"task_template_id" uuid,
	"name" varchar(120) NOT NULL,
	"default_hours" numeric(6, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "hour_rule_bounds_check" CHECK ("lub"."hour_rules"."default_hours" between 0 and 1000 and "lub"."hour_rules"."revision">0 and length(trim("lub"."hour_rules"."name")) between 2 and 120 and ("lub"."hour_rules"."effective_to" is null or "lub"."hour_rules"."effective_to">="lub"."hour_rules"."effective_from"))
);
--> statement-breakpoint
ALTER TABLE "lub"."hour_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."membership_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"renewal_campaign_id" uuid NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"response_code" varchar(20) DEFAULT 'Pending' NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "renewal_campaign_member_unique" UNIQUE("renewal_campaign_id","organization_membership_id"),
	CONSTRAINT "renewal_response_check" CHECK ("lub"."membership_renewals"."response_code" in ('Pending','Renewed','Declined','No_Response') and ("lub"."membership_renewals"."response_code"='Pending')=("lub"."membership_renewals"."responded_at" is null))
);
--> statement-breakpoint
ALTER TABLE "lub"."membership_renewals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."renewal_campaign_exclusions" (
	"renewal_campaign_id" uuid NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"reason" varchar(300) NOT NULL,
	CONSTRAINT "renewal_campaign_exclusions_renewal_campaign_id_organization_membership_id_pk" PRIMARY KEY("renewal_campaign_id","organization_membership_id"),
	CONSTRAINT "renewal_exclusion_reason_check" CHECK (length(trim("lub"."renewal_campaign_exclusions"."reason")) between 1 and 300)
);
--> statement-breakpoint
ALTER TABLE "lub"."renewal_campaign_exclusions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."renewal_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"academic_term_id" uuid NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"exclude_leadership" boolean DEFAULT false NOT NULL,
	"status_code" varchar(20) DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renewal_org_term_unique" UNIQUE("organization_id","academic_term_id"),
	CONSTRAINT "renewal_bounds_check" CHECK ("lub"."renewal_campaigns"."closes_at">"lub"."renewal_campaigns"."opens_at" and "lub"."renewal_campaigns"."status_code" in ('Draft','Open','Closed','Archived'))
);
--> statement-breakpoint
ALTER TABLE "lub"."renewal_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."notifications" DROP CONSTRAINT "notification_target_check";--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_code_check";--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_scope_check";--> statement-breakpoint
ALTER TABLE "lub"."organizations" ADD COLUMN "self_report_hours_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "lub"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_task_participant_id_task_participants_id_fk" FOREIGN KEY ("task_participant_id") REFERENCES "lub"."task_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_organization_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("organization_membership_id","organization_id") REFERENCES "lub"."organization_memberships"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_rules" ADD CONSTRAINT "hour_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_rules" ADD CONSTRAINT "hour_rules_task_template_id_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "lub"."task_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_rules" ADD CONSTRAINT "hour_rules_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_renewals" ADD CONSTRAINT "membership_renewals_renewal_campaign_id_renewal_campaigns_id_fk" FOREIGN KEY ("renewal_campaign_id") REFERENCES "lub"."renewal_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."membership_renewals" ADD CONSTRAINT "membership_renewals_organization_membership_id_organization_memberships_id_fk" FOREIGN KEY ("organization_membership_id") REFERENCES "lub"."organization_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."renewal_campaign_exclusions" ADD CONSTRAINT "renewal_campaign_exclusions_renewal_campaign_id_renewal_campaigns_id_fk" FOREIGN KEY ("renewal_campaign_id") REFERENCES "lub"."renewal_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."renewal_campaign_exclusions" ADD CONSTRAINT "renewal_campaign_exclusions_organization_membership_id_organization_memberships_id_fk" FOREIGN KEY ("organization_membership_id") REFERENCES "lub"."organization_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."renewal_campaigns" ADD CONSTRAINT "renewal_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."renewal_campaigns" ADD CONSTRAINT "renewal_campaigns_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "lub"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_term_dates_idx" ON "lub"."academic_terms" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "hour_member_term_status_idx" ON "lub"."hour_records" USING btree ("organization_membership_id","academic_term_id","status_code");--> statement-breakpoint
CREATE INDEX "hour_scope_time_idx" ON "lub"."hour_records" USING btree ("organization_id","committee_id","created_at");--> statement-breakpoint
CREATE INDEX "hour_rule_scope_idx" ON "lub"."hour_rules" USING btree ("organization_id","committee_id","effective_from");--> statement-breakpoint
CREATE INDEX "renewal_member_idx" ON "lub"."membership_renewals" USING btree ("organization_membership_id");--> statement-breakpoint
CREATE INDEX "renewal_org_time_idx" ON "lub"."renewal_campaigns" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "lub"."notifications" ADD CONSTRAINT "notification_target_check" CHECK ("lub"."notifications"."target_url" ~ '^/tasks/[0-9a-f-]{36}$' or "lub"."notifications"."target_url" in ('/hours','/renewals'));--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_code_check" CHECK ("lub"."permission_grants"."permission_code" in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE'));--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_scope_check" CHECK ("lub"."permission_grants"."committee_id" is null or "lub"."permission_grants"."permission_code" in ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'));