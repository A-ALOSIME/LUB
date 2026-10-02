ALTER TABLE "lub"."tasks" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "lub"."events" ADD CONSTRAINT "event_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "lub"."tasks" ADD CONSTRAINT "tasks_event_id_organization_id_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "lub"."events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_event_idx" ON "lub"."tasks" USING btree ("event_id");
