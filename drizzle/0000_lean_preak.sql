CREATE SCHEMA "lub";
--> statement-breakpoint
CREATE TABLE "lub"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action_code" varchar(80) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lub"."audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."profile_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"public_profile_enabled" boolean DEFAULT false NOT NULL,
	"show_total_hours" boolean DEFAULT true NOT NULL,
	"show_role_history" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."student_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name_ar" varchar(120) NOT NULL,
	"university_id_ciphertext" text NOT NULL,
	"university_id_lookup_hash" varchar(64) NOT NULL,
	"major_name" varchar(120) NOT NULL,
	"academic_level" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_university_id_lookup_hash_unique" UNIQUE("university_id_lookup_hash")
);
--> statement-breakpoint
ALTER TABLE "lub"."student_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lub"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(16),
	"status_code" varchar(20) DEFAULT 'Active' NOT NULL,
	"email_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_status_check" CHECK ("lub"."users"."status_code" in ('Active', 'Inactive'))
);
--> statement-breakpoint
ALTER TABLE "lub"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" ADD CONSTRAINT "profile_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "lub"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_time_idx" ON "lub"."audit_log" USING btree ("actor_user_id","created_at");