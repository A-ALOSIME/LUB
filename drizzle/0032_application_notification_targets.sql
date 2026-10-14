ALTER TABLE lub.notifications DROP CONSTRAINT notification_target_check;
--> statement-breakpoint
ALTER TABLE lub.notifications ADD CONSTRAINT notification_target_check CHECK(
  target_url ~ '^/(tasks|events)/[0-9a-f-]{36}$'
  OR target_url IN ('/hours','/renewals','/applications')
);
