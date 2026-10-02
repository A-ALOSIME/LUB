-- Binding protection must see references even when their owner is inactive and
-- cannot SELECT those references through ordinary RLS.
CREATE FUNCTION lub.can_delete_application_object(target text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT split_part(target,'/',1)=auth.uid()::text
 AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active')
 AND NOT EXISTS(SELECT 1 FROM lub.application_assets a JOIN lub.form_response_assets f
 ON f.asset_id=a.id WHERE a.object_key=target);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.can_delete_application_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.can_delete_application_object(text) TO authenticated;
DROP POLICY lub_files_delete ON storage.objects;
CREATE POLICY lub_files_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='lub-application-files' AND lub.can_delete_application_object(name));
