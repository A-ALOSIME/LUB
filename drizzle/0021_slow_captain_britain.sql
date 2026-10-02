CREATE TABLE "lub"."profile_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"link_type" varchar(20) NOT NULL,
	"label" varchar(80) NOT NULL,
	"url_or_value" varchar(2048) NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	CONSTRAINT "talent_link_check" CHECK ("lub"."profile_links"."link_type" in ('Email','Phone','Website','LinkedIn','GitHub') and length(trim("lub"."profile_links"."label")) between 1 and 80 and length(trim("lub"."profile_links"."url_or_value"))>0)
);
--> statement-breakpoint
ALTER TABLE "lub"."profile_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."profile_organization_settings" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"show_hours" boolean DEFAULT true NOT NULL,
	"show_membership_history" boolean DEFAULT true NOT NULL,
	CONSTRAINT "profile_organization_settings_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "lub"."profile_organization_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" varchar(80) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "skills_name_ar_unique" UNIQUE("name_ar"),
	CONSTRAINT "talent_skill_name_check" CHECK (length(trim("lub"."skills"."name_ar")) between 2 and 80)
);
--> statement-breakpoint
ALTER TABLE "lub"."skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."student_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_participant_id" uuid,
	"event_contribution_id" uuid,
	"display_title" varchar(120) NOT NULL,
	"display_description" varchar(1000) DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_projects_task_participant_id_unique" UNIQUE("task_participant_id"),
	CONSTRAINT "student_projects_event_contribution_id_unique" UNIQUE("event_contribution_id"),
	CONSTRAINT "talent_project_source_check" CHECK (("lub"."student_projects"."task_participant_id" is null)<>("lub"."student_projects"."event_contribution_id" is null) and length(trim("lub"."student_projects"."display_title")) between 2 and 120)
);
--> statement-breakpoint
ALTER TABLE "lub"."student_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."student_skills" (
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"source_code" varchar(20) DEFAULT 'Self_Declared' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	CONSTRAINT "student_skills_user_id_skill_id_pk" PRIMARY KEY("user_id","skill_id"),
	CONSTRAINT "talent_skill_source_check" CHECK ("lub"."student_skills"."source_code"='Self_Declared')
);
--> statement-breakpoint
ALTER TABLE "lub"."student_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" ADD COLUMN "show_events" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" ADD COLUMN "show_projects" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lub"."student_profiles" ADD COLUMN "bio" varchar(1000) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lub"."profile_links" ADD CONSTRAINT "profile_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."profile_organization_settings" ADD CONSTRAINT "profile_organization_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."profile_organization_settings" ADD CONSTRAINT "profile_organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."student_projects" ADD CONSTRAINT "student_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."student_projects" ADD CONSTRAINT "student_projects_task_participant_id_task_participants_id_fk" FOREIGN KEY ("task_participant_id") REFERENCES "lub"."task_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."student_projects" ADD CONSTRAINT "student_projects_event_contribution_id_event_contributions_id_fk" FOREIGN KEY ("event_contribution_id") REFERENCES "lub"."event_contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."student_skills" ADD CONSTRAINT "student_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."student_skills" ADD CONSTRAINT "student_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "lub"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "talent_link_user_idx" ON "lub"."profile_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "talent_project_user_idx" ON "lub"."student_projects" USING btree ("user_id","is_featured","created_at");