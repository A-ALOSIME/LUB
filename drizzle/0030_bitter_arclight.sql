ALTER TABLE "lub"."membership_applications" DROP CONSTRAINT "one_application_per_round";--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_application_per_round_idx" ON "lub"."membership_applications" USING btree ("registration_round_id","applicant_user_id") WHERE "lub"."membership_applications"."status_code"<>'Withdrawn';--> statement-breakpoint
