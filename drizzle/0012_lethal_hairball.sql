CREATE TABLE "lub"."hour_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hour_record_id" uuid NOT NULL,
	"status_code" varchar(20) NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hour_decision_state_check" CHECK ("lub"."hour_decisions"."status_code" in ('Approved','Rejected','Voided') and length("lub"."hour_decisions"."note")<=3000)
);
--> statement-breakpoint
ALTER TABLE "lub"."hour_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lub"."hour_decisions" ADD CONSTRAINT "hour_decisions_hour_record_id_hour_records_id_fk" FOREIGN KEY ("hour_record_id") REFERENCES "lub"."hour_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lub"."hour_decisions" ADD CONSTRAINT "hour_decisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hour_decision_record_idx" ON "lub"."hour_decisions" USING btree ("hour_record_id");