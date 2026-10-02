CREATE TABLE "lub"."event_assets" (
	"event_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"asset_type_code" varchar(20) NOT NULL,
	CONSTRAINT "event_assets_event_id_asset_id_pk" PRIMARY KEY("event_id","asset_id"),
	CONSTRAINT "event_asset_type_check" CHECK ("lub"."event_assets"."asset_type_code" in ('Approval','Attendance','Report','Photo'))
);
--> statement-breakpoint
ALTER TABLE "lub"."event_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."event_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_registration_id" uuid NOT NULL,
	"status_code" varchar(20) NOT NULL,
	"checked_in_at" timestamp with time zone,
	"marked_by_user_id" uuid NOT NULL,
	CONSTRAINT "event_attendance_event_registration_id_unique" UNIQUE("event_registration_id"),
	CONSTRAINT "event_attendance_state_check" CHECK ("lub"."event_attendance"."status_code" in ('Pending','Present','Absent','Excused') and ("lub"."event_attendance"."status_code"='Present')=("lub"."event_attendance"."checked_in_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "lub"."event_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."event_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"contribution_type_code" varchar(20) NOT NULL,
	"title" varchar(120) NOT NULL,
	"verified_by_user_id" uuid NOT NULL,
	"show_on_profile" boolean DEFAULT true NOT NULL,
	CONSTRAINT "event_contribution_user_type_unique" UNIQUE("event_id","user_id","contribution_type_code"),
	CONSTRAINT "event_contribution_type_check" CHECK ("lub"."event_contributions"."contribution_type_code" in ('Presenter','Trainer','Core_Contributor') and length(trim("lub"."event_contributions"."title")) between 2 and 120)
);
--> statement-breakpoint
ALTER TABLE "lub"."event_contributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"form_response_id" uuid,
	"status_code" varchar(20) DEFAULT 'Registered' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"show_on_profile" boolean DEFAULT true NOT NULL,
	CONSTRAINT "event_registrations_form_response_id_unique" UNIQUE("form_response_id"),
	CONSTRAINT "event_registration_user_unique" UNIQUE("event_id","user_id"),
	CONSTRAINT "event_registration_state_check" CHECK ("lub"."event_registrations"."status_code" in ('Registered','Cancelled') and ("lub"."event_registrations"."status_code"='Cancelled')=("lub"."event_registrations"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "lub"."event_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"duplicated_from_event_id" uuid,
	"registration_form_template_id" uuid,
	"title" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"location_type_code" varchar(20) NOT NULL,
	"location_text" varchar(500),
	"online_url" varchar(2048),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"registration_closes_at" timestamp with time zone NOT NULL,
	"capacity" integer,
	"attendance_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"status_code" varchar(20) DEFAULT 'Draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_bounds_check" CHECK (length(trim("lub"."events"."title")) between 2 and 120 and length("lub"."events"."description")<=6000 and "lub"."events"."ends_at">"lub"."events"."starts_at" and "lub"."events"."registration_closes_at">"lub"."events"."registration_opens_at" and "lub"."events"."registration_closes_at"<="lub"."events"."starts_at" and ("lub"."events"."capacity" is null or "lub"."events"."capacity" between 1 and 10000) and "lub"."events"."attendance_hours" between 0 and 1000 and "lub"."events"."revision">0),
	CONSTRAINT "event_state_check" CHECK ("lub"."events"."status_code" in ('Draft','Published','Completed','Cancelled') and ("lub"."events"."status_code"='Completed')=("lub"."events"."completed_at" is not null) and ("lub"."events"."status_code"='Cancelled')=("lub"."events"."cancelled_at" is not null)),
	CONSTRAINT "event_location_check" CHECK ("lub"."events"."location_type_code" in ('In_Person','Online','Hybrid') and ("lub"."events"."location_type_code"='Online' or coalesce(length(trim("lub"."events"."location_text")),0)>0) and ("lub"."events"."location_type_code"='In_Person' or coalesce("lub"."events"."online_url",'')~'^https://[^[:space:]]+$'))
);
--> statement-breakpoint
ALTER TABLE "lub"."events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" DROP CONSTRAINT "hour_record_source_check";--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" DROP CONSTRAINT "grant_code_check";--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD COLUMN "event_attendance_id" uuid;--> statement-breakpoint
ALTER TABLE "lub"."event_assets" ADD CONSTRAINT "event_assets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "lub"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_assets" ADD CONSTRAINT "event_assets_asset_id_application_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "lub"."application_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_attendance" ADD CONSTRAINT "event_attendance_event_registration_id_event_registrations_id_fk" FOREIGN KEY ("event_registration_id") REFERENCES "lub"."event_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_attendance" ADD CONSTRAINT "event_attendance_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_contributions" ADD CONSTRAINT "event_contributions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "lub"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_contributions" ADD CONSTRAINT "event_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_contributions" ADD CONSTRAINT "event_contributions_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "lub"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."event_registrations" ADD CONSTRAINT "event_registrations_form_response_id_form_responses_id_fk" FOREIGN KEY ("form_response_id") REFERENCES "lub"."form_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."events" ADD CONSTRAINT "events_registration_form_template_id_form_templates_id_fk" FOREIGN KEY ("registration_form_template_id") REFERENCES "lub"."form_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_registration_user_idx" ON "lub"."event_registrations" USING btree ("user_id","registered_at");--> statement-breakpoint
CREATE INDEX "event_public_time_idx" ON "lub"."events" USING btree ("status_code","starts_at","id");--> statement-breakpoint
CREATE INDEX "event_org_time_idx" ON "lub"."events" USING btree ("organization_id","starts_at","id");--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_event_attendance_id_event_attendance_id_fk" FOREIGN KEY ("event_attendance_id") REFERENCES "lub"."event_attendance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_records_event_attendance_id_unique" UNIQUE("event_attendance_id");--> statement-breakpoint
ALTER TABLE "lub"."hour_records" ADD CONSTRAINT "hour_record_source_check" CHECK ("lub"."hour_records"."source_code" in ('TASK','MANUAL','SELF_REPORTED','EVENT') and ("lub"."hour_records"."source_code"='EVENT')=("lub"."hour_records"."event_attendance_id" is not null) and ("lub"."hour_records"."source_code"='TASK')=("lub"."hour_records"."task_participant_id" is not null));--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "grant_code_check" CHECK ("lub"."permission_grants"."permission_code" in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE'));
ALTER TABLE lub.notifications DROP CONSTRAINT notification_target_check;
ALTER TABLE lub.notifications ADD CONSTRAINT notification_target_check CHECK(target_url ~ '^/(tasks|events)/[0-9a-f-]{36}$' OR target_url IN ('/hours','/renewals'));
