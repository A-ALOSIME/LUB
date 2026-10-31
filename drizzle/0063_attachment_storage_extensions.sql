-- Extend the existing owner-only upload policy to the trusted MIME suffixes.
ALTER POLICY lub_files_insert ON storage.objects WITH CHECK(
 bucket_id='lub-application-files'
 AND name ~ ('^'||auth.uid()::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}([.](pdf|jpg|png))?$')
 AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active')
);
