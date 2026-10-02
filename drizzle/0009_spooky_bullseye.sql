CREATE TABLE "lub"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"type_code" varchar(40) NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"target_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_target_check" CHECK ("lub"."notifications"."target_url" ~ '^/tasks/[0-9a-f-]{36}$')
);
--> statement-breakpoint
ALTER TABLE "lub"."notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."task_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status_code" varchar(20) DEFAULT 'Joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"approved_hours_override" numeric(6, 2),
	CONSTRAINT "task_user_unique" UNIQUE("task_id","user_id"),
	CONSTRAINT "task_participant_state_check" CHECK ("lub"."task_participants"."status_code" in ('Joined','In_Progress','Submitted','Approved','Closed') and ("lub"."task_participants"."status_code" in ('Approved','Closed'))=("lub"."task_participants"."closed_at" is not null)),
	CONSTRAINT "task_participant_hours_check" CHECK ("lub"."task_participants"."approved_hours_override" is null or "lub"."task_participants"."approved_hours_override" between 0 and 1000)
);
--> statement-breakpoint
ALTER TABLE "lub"."task_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."task_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_revision_unique" UNIQUE("task_id","revision_number")
);
--> statement-breakpoint
ALTER TABLE "lub"."task_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."task_submission_assets" (
	"task_submission_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "task_submission_assets_task_submission_id_asset_id_pk" PRIMARY KEY("task_submission_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "lub"."task_submission_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."task_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_participant_id" uuid NOT NULL,
	"task_revision_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"message" text NOT NULL,
	"status_code" varchar(20) DEFAULT 'Submitted' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"review_note" text,
	CONSTRAINT "task_submission_revision_unique" UNIQUE("task_participant_id","revision_number"),
	CONSTRAINT "task_submission_state_check" CHECK ("lub"."task_submissions"."status_code" in ('Submitted','Approved','Rejected') and ("lub"."task_submissions"."status_code"<>'Submitted')=("lub"."task_submissions"."reviewed_at" is not null) and ("lub"."task_submissions"."status_code"<>'Submitted')=("lub"."task_submissions"."reviewed_by_user_id" is not null)),
	CONSTRAINT "task_submission_text_check" CHECK (length("lub"."task_submissions"."message")<=6000 and length(coalesce("lub"."task_submissions"."review_note",''))<=3000 and "lub"."task_submissions"."revision_number">0)
);
--> statement-breakpoint
ALTER TABLE "lub"."task_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"name" varchar(120) NOT NULL,
	"description_template" text NOT NULL,
	"default_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"copied_from_template_id" uuid,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_template_text_check" CHECK (length(trim("lub"."task_templates"."name")) between 2 and 120 and length("lub"."task_templates"."description_template") between 1 and 6000),
	CONSTRAINT "task_template_hours_check" CHECK ("lub"."task_templates"."default_hours" between 0 and 1000 and "lub"."task_templates"."revision">0)
);
--> statement-breakpoint
ALTER TABLE "lub"."task_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"task_template_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"starts_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"default_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"status_code" varchar(20) DEFAULT 'Draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_text_check" CHECK (length(trim("lub"."tasks"."title")) between 2 and 120 and length(trim("lub"."tasks"."description")) between 1 and 6000),
	CONSTRAINT "task_state_check" CHECK ("lub"."tasks"."status_code" in ('Draft','Open','Completed','Cancelled') and ("lub"."tasks"."status_code" in ('Completed','Cancelled'))=("lub"."tasks"."closed_at" is not null)),
	CONSTRAINT "task_bounds_check" CHECK ("lub"."tasks"."default_hours" between 0 and 1000 and "lub"."tasks"."revision">0 and ("lub"."tasks"."starts_at" is null or "lub"."tasks"."due_at" is null or "lub"."tasks"."due_at">"lub"."tasks"."starts_at"))
);
--> statement-breakpoint
ALTER TABLE "lub"."tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_code_check";--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_scope_check";--> statement-breakpoint
ALTER TABLE "lub"."notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_participants" ADD CONSTRAINT "task_participants_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "lub"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_participants" ADD CONSTRAINT "task_participants_organization_membership_id_organization_memberships_id_fk" FOREIGN KEY ("organization_membership_id") REFERENCES "lub"."organization_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_participants" ADD CONSTRAINT "task_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_participants" ADD CONSTRAINT "task_participants_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_revisions" ADD CONSTRAINT "task_revisions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "lub"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_revisions" ADD CONSTRAINT "task_revisions_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_submission_assets" ADD CONSTRAINT "task_submission_assets_task_submission_id_task_submissions_id_fk" FOREIGN KEY ("task_submission_id") REFERENCES "lub"."task_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_submission_assets" ADD CONSTRAINT "task_submission_assets_asset_id_application_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "lub"."application_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_submissions" ADD CONSTRAINT "task_submissions_task_participant_id_task_participants_id_fk" FOREIGN KEY ("task_participant_id") REFERENCES "lub"."task_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_submissions" ADD CONSTRAINT "task_submissions_task_revision_id_task_revisions_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "lub"."task_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_submissions" ADD CONSTRAINT "task_submissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_templates" ADD CONSTRAINT "task_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_templates" ADD CONSTRAINT "task_templates_copied_from_template_id_task_templates_id_fk" FOREIGN KEY ("copied_from_template_id") REFERENCES "lub"."task_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."task_templates" ADD CONSTRAINT "task_templates_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."tasks" ADD CONSTRAINT "tasks_task_template_id_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "lub"."task_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."tasks" ADD CONSTRAINT "tasks_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_recipient_time_idx" ON "lub"."notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_task_submission_idx" ON "lub"."task_submissions" USING btree ("task_participant_id") WHERE "lub"."task_submissions"."status_code"='Submitted';--> statement-breakpoint
CREATE INDEX "task_template_scope_idx" ON "lub"."task_templates" USING btree ("organization_id","committee_id");--> statement-breakpoint
CREATE INDEX "task_scope_status_idx" ON "lub"."tasks" USING btree ("organization_id","committee_id","status_code");--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_code_check" CHECK ("lub"."permission_grants"."permission_code" in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE'));--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_scope_check" CHECK ("lub"."permission_grants"."committee_id" is null or "lub"."permission_grants"."permission_code" in ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','TASKS_MANAGE','TASK_TEMPLATES_MANAGE'));