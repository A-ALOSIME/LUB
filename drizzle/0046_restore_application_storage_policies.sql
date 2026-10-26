-- Repair deployed policy drift without changing the bucket's privacy or limits.
-- Uploads remain scoped to the active actor; linked objects cannot be deleted.
DROP POLICY IF EXISTS lub_files_insert ON storage.objects;
--> statement-breakpoint
CREATE POLICY lub_files_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='lub-application-files'
 AND name ~ ('^'||auth.uid()::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'));
--> statement-breakpoint
DROP POLICY IF EXISTS lub_files_read ON storage.objects;
--> statement-breakpoint
CREATE POLICY lub_files_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='lub-application-files' AND (lub.can_read_asset(name)
 OR (split_part(name,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'))));
--> statement-breakpoint
DROP POLICY IF EXISTS lub_files_delete ON storage.objects;
--> statement-breakpoint
CREATE POLICY lub_files_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='lub-application-files' AND lub.can_delete_application_object(name));
--> statement-breakpoint
DROP POLICY IF EXISTS public_event_posters ON storage.objects;
--> statement-breakpoint
CREATE POLICY public_event_posters ON storage.objects FOR SELECT TO anon,authenticated
USING(bucket_id='lub-application-files' AND lub.can_read_published_event_poster(name));
