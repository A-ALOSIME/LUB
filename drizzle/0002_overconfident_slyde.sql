CREATE TABLE "lub"."committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"status_code" varchar(20) DEFAULT 'Active' NOT NULL,
	"copied_from_committee_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "committee_org_identity_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "committee_status_check" CHECK ("lub"."committees"."status_code" in ('Active', 'Archived')),
	CONSTRAINT "committee_archive_check" CHECK (("lub"."committees"."status_code" = 'Archived') = ("lub"."committees"."archived_at" is not null)),
	CONSTRAINT "committee_text_check" CHECK (char_length("lub"."committees"."name") between 2 and 120 and char_length("lub"."committees"."description") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "lub"."committees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."global_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_code" varchar(10) NOT NULL,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone,
	"assigned_by_user_id" uuid NOT NULL,
	CONSTRAINT "global_role_code_check" CHECK ("lub"."global_role_assignments"."role_code" = 'SA'),
	CONSTRAINT "global_role_dates_check" CHECK ("lub"."global_role_assignments"."end_at" is null or "lub"."global_role_assignments"."end_at" >= "lub"."global_role_assignments"."start_at")
);
--> statement-breakpoint
ALTER TABLE "lub"."global_role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."organization_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_type" varchar(80) NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "org_link_https_check" CHECK ("lub"."organization_links"."url" ~ '^https://[^[:space:]]+$' and char_length("lub"."organization_links"."url") <= 2048)
);
--> statement-breakpoint
ALTER TABLE "lub"."organization_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status_code" varchar(20) DEFAULT 'Active' NOT NULL,
	"start_date" date DEFAULT current_date NOT NULL,
	"end_date" date,
	"ended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_org_identity_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "membership_status_check" CHECK ("lub"."organization_memberships"."status_code" in ('Active', 'Inactive', 'Ended')),
	CONSTRAINT "membership_dates_check" CHECK ("lub"."organization_memberships"."end_date" is null or "lub"."organization_memberships"."end_date" >= "lub"."organization_memberships"."start_date"),
	CONSTRAINT "membership_ended_check" CHECK ("lub"."organization_memberships"."status_code" <> 'Ended' or "lub"."organization_memberships"."end_date" is not null)
);
--> statement-breakpoint
ALTER TABLE "lub"."organization_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."organization_tags" (
	"organization_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "organization_tags_organization_id_tag_id_pk" PRIMARY KEY("organization_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "lub"."organization_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_code" varchar(20) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name_ar" varchar(120) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"mission" text DEFAULT '' NOT NULL,
	"status_code" varchar(20) DEFAULT 'Active' NOT NULL,
	"show_leadership_publicly" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "org_type_check" CHECK ("lub"."organizations"."type_code" in ('Club', 'Council')),
	CONSTRAINT "org_status_check" CHECK ("lub"."organizations"."status_code" in ('Active', 'Inactive', 'Archived')),
	CONSTRAINT "org_slug_check" CHECK ("lub"."organizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "org_archive_check" CHECK (("lub"."organizations"."status_code" = 'Archived') = ("lub"."organizations"."archived_at" is not null)),
	CONSTRAINT "org_text_check" CHECK (char_length("lub"."organizations"."name_ar") between 2 and 120 and char_length("lub"."organizations"."summary") <= 1000 and char_length("lub"."organizations"."mission") <= 3000)
);
--> statement-breakpoint
ALTER TABLE "lub"."organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."permission_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"permission_code" varchar(80) NOT NULL,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone,
	"granted_by_user_id" uuid NOT NULL,
	CONSTRAINT "grant_code_check" CHECK ("lub"."permission_grants"."permission_code" in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW')),
	CONSTRAINT "grant_scope_check" CHECK ("lub"."permission_grants"."committee_id" is null or "lub"."permission_grants"."permission_code" in ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW')),
	CONSTRAINT "grant_dates_check" CHECK ("lub"."permission_grants"."end_at" is null or "lub"."permission_grants"."end_at" > "lub"."permission_grants"."start_at")
);
--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_membership_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"role_code" varchar(10) NOT NULL,
	"is_primary_leader" boolean DEFAULT false NOT NULL,
	"start_date" date DEFAULT current_date NOT NULL,
	"end_date" date,
	"assigned_by_user_id" uuid NOT NULL,
	CONSTRAINT "role_scope_check" CHECK (("lub"."role_assignments"."role_code" in ('OL','OD') and "lub"."role_assignments"."committee_id" is null) or ("lub"."role_assignments"."role_code" in ('CL','CD') and "lub"."role_assignments"."committee_id" is not null)),
	CONSTRAINT "role_primary_check" CHECK ("lub"."role_assignments"."is_primary_leader" = ("lub"."role_assignments"."role_code" = 'OL')),
	CONSTRAINT "role_dates_check" CHECK ("lub"."role_assignments"."end_date" is null or "lub"."role_assignments"."end_date" >= "lub"."role_assignments"."start_date")
);
--> statement-breakpoint
ALTER TABLE "lub"."role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" varchar(40) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tags_name_ar_unique" UNIQUE("name_ar")
);
--> statement-breakpoint
ALTER TABLE "lub"."tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."audit_log" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "lub"."committees" ADD CONSTRAINT "committees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."committees" ADD CONSTRAINT "committees_copied_from_committee_id_committees_id_fk" FOREIGN KEY ("copied_from_committee_id") REFERENCES "lub"."committees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."global_role_assignments" ADD CONSTRAINT "global_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."global_role_assignments" ADD CONSTRAINT "global_role_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."organization_links" ADD CONSTRAINT "organization_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."organization_tags" ADD CONSTRAINT "organization_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."organization_tags" ADD CONSTRAINT "organization_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "lub"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "permission_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "permission_grants_organization_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("organization_membership_id","organization_id") REFERENCES "lub"."organization_memberships"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."permission_grants" ADD CONSTRAINT "permission_grants_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."role_assignments" ADD CONSTRAINT "role_assignments_organization_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("organization_membership_id","organization_id") REFERENCES "lub"."organization_memberships"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."role_assignments" ADD CONSTRAINT "role_assignments_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "committee_org_idx" ON "lub"."committees" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_current_sa_assignment_idx" ON "lub"."global_role_assignments" USING btree ("user_id") WHERE "lub"."global_role_assignments"."end_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_membership_idx" ON "lub"."organization_memberships" USING btree ("organization_id","user_id") WHERE "lub"."organization_memberships"."status_code" = 'Active' and "lub"."organization_memberships"."end_date" is null;--> statement-breakpoint
CREATE INDEX "org_status_name_idx" ON "lub"."organizations" USING btree ("status_code","name_ar");--> statement-breakpoint
CREATE INDEX "grant_membership_idx" ON "lub"."permission_grants" USING btree ("organization_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_primary_leader_idx" ON "lub"."role_assignments" USING btree ("organization_id") WHERE "lub"."role_assignments"."is_primary_leader" and "lub"."role_assignments"."end_date" is null;--> statement-breakpoint
CREATE INDEX "role_membership_idx" ON "lub"."role_assignments" USING btree ("organization_membership_id");--> statement-breakpoint
ALTER TABLE "lub"."audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "lub"."organizations"("id") ON DELETE restrict ON UPDATE no action;