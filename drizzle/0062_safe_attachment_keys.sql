ALTER TABLE lub.application_assets DROP CONSTRAINT application_asset_key_check;
ALTER TABLE lub.application_assets ADD CONSTRAINT application_asset_key_check CHECK (
 object_key=owner_user_id::text||'/'||id::text OR
 object_key=owner_user_id::text||'/'||id::text||CASE mime_type WHEN 'application/pdf' THEN '.pdf' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '' END
);
--> statement-breakpoint
-- Original names are display metadata. New objects use an ASCII UUID plus a trusted MIME extension.
-- Accept the old UUID-only key as well, so earlier clients remain compatible during deployment.
CREATE OR REPLACE FUNCTION lub.register_application_asset(target uuid,key text,name text,mime text,size int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base text; extension text;
BEGIN
 base:=auth.uid()::text||'/'||target::text;
 extension:=CASE mime WHEN 'application/pdf' THEN '.pdf' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE NULL END;
 IF target IS NULL OR extension IS NULL OR key IS NULL OR key NOT IN (base,base||extension) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') OR name IS NULL OR length(name) NOT BETWEEN 1 AND 120 OR name ~ '[[:cntrl:]/]' OR position(chr(92) in name)>0 THEN RAISE EXCEPTION 'Invalid asset'; END IF;
 IF (SELECT count(*) FROM lub.application_assets WHERE owner_user_id=auth.uid() AND created_at>now()-interval '1 day')>=30 THEN RAISE EXCEPTION 'Upload quota'; END IF;
 INSERT INTO lub.application_assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) VALUES(target,auth.uid(),key,name,mime,size);
END; $$;
