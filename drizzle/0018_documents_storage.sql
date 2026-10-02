CREATE OR REPLACE FUNCTION lub.guard_generated_document() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status_code','archived_at','upload_attempt','upload_started_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status_code','archived_at','upload_attempt','upload_started_at']) THEN RAISE EXCEPTION 'Document snapshot is immutable'; END IF;
 IF OLD.status_code='Ready' AND NEW.status_code='Archived' AND NEW.upload_attempt=OLD.upload_attempt AND NEW.upload_started_at=OLD.upload_started_at THEN RETURN NEW; END IF;
 IF OLD.status_code='Generating' AND NEW.status_code IN('Ready','Failed') AND NEW.upload_attempt=OLD.upload_attempt AND NEW.upload_started_at=OLD.upload_started_at THEN RETURN NEW; END IF;
 IF NEW.status_code='Generating' AND (OLD.status_code='Failed' OR (OLD.status_code='Generating' AND OLD.upload_started_at<clock_timestamp()-interval '15 minutes')) AND NEW.upload_attempt<>OLD.upload_attempt AND NEW.upload_started_at>OLD.upload_started_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Invalid document transition';
END; $$;
CREATE FUNCTION lub.document_upload(target uuid) RETURNS TABLE(document_id uuid,upload_attempt uuid,body text,mime_type text,original_name text,storage_key text,checksum_sha256 text,size_bytes int) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d lub.generated_documents;
BEGIN
 SELECT * INTO d FROM lub.generated_documents WHERE id=target;
 IF d.id IS NULL OR d.status_code<>'Generating' OR NOT(lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id)) THEN RAISE EXCEPTION 'Upload unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT d.id,d.upload_attempt,a.body,a.mime_type::text,a.original_name::text,a.storage_key::text,a.checksum_sha256::text,a.size_bytes FROM lub.assets a WHERE a.id=d.asset_id;
END; $$;
CREATE FUNCTION lub.retry_document(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d lub.generated_documents;
BEGIN
 SELECT * INTO d FROM lub.generated_documents WHERE id=target FOR UPDATE;
 IF d.id IS NULL OR NOT(lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id)) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF d.status_code<>'Failed' AND NOT(d.status_code='Generating' AND d.upload_started_at<clock_timestamp()-interval '15 minutes') THEN RAISE EXCEPTION 'Retry unavailable'; END IF;
 UPDATE lub.generated_documents SET status_code='Generating',upload_attempt=gen_random_uuid(),upload_started_at=clock_timestamp() WHERE id=target;PERFORM lub.document_audit(target,d.organization_id,'DOCUMENT_RETRIED');RETURN target;
END; $$;
CREATE FUNCTION lub.complete_document(target uuid,attempt uuid,success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d lub.generated_documents;
BEGIN
 SELECT * INTO d FROM lub.generated_documents WHERE id=target FOR UPDATE;
 IF d.id IS NULL OR d.status_code<>'Generating' OR d.upload_attempt IS DISTINCT FROM attempt OR success IS NULL OR NOT(lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id)) THEN RAISE EXCEPTION 'Upload attempt unavailable' USING ERRCODE='42501'; END IF;
 IF success AND NOT EXISTS(SELECT 1 FROM storage.objects s JOIN lub.assets a ON a.storage_key=s.name WHERE a.id=d.asset_id AND s.bucket_id='lub-generated-documents') THEN RAISE EXCEPTION 'Stored file required'; END IF;
 UPDATE lub.generated_documents SET status_code=CASE WHEN success THEN 'Ready' ELSE 'Failed' END WHERE id=target;PERFORM lub.document_audit(target,d.organization_id,CASE WHEN success THEN 'DOCUMENT_READY' ELSE 'DOCUMENT_FAILED' END);
END; $$;
DROP FUNCTION lub.document_asset(uuid);
CREATE FUNCTION lub.document_asset(target uuid) RETURNS TABLE(body text,mime_type text,original_name text,storage_key text,checksum_sha256 text,size_bytes int) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 IF NOT lub.can_read_document(target) OR NOT EXISTS(SELECT 1 FROM lub.generated_documents WHERE id=target AND status_code IN('Ready','Archived')) THEN RAISE EXCEPTION 'Document unavailable' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM lub.generated_documents WHERE id=target;PERFORM lub.document_audit(target,org,'DOCUMENT_ACCESSED');
 RETURN QUERY SELECT a.body,a.mime_type::text,a.original_name::text,a.storage_key::text,a.checksum_sha256::text,a.size_bytes FROM lub.assets a JOIN lub.generated_documents d ON d.asset_id=a.id WHERE d.id=target;
END; $$;
-- Lock the document while Storage writes authorize. Ready finalization takes an
-- exclusive lock, preventing a stale upload cleanup from deleting a ready file.
CREATE FUNCTION lub.can_upload_document(key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d lub.generated_documents;
BEGIN
 SELECT doc.* INTO d FROM lub.generated_documents doc JOIN lub.assets a ON a.id=doc.asset_id WHERE a.storage_key=key FOR SHARE OF doc;
 RETURN d.id IS NOT NULL AND d.status_code='Generating' AND (lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id));
END; $$;
CREATE FUNCTION lub.can_read_document_file(key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.generated_documents d JOIN lub.assets a ON a.id=d.asset_id WHERE a.storage_key=key AND d.status_code IN('Ready','Archived') AND lub.can_read_document(d.id));
$$;
DROP FUNCTION lub.report_members(uuid,uuid,int);
CREATE FUNCTION lub.report_members(org uuid,committee uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text,start_date date,end_date date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text,m.start_date,m.end_date FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE m.organization_id=org AND (lub.has_org_permission(org,'REPORTS_GENERATE') OR lub.has_org_permission(org,'REPORTS_GENERATE',committee)) AND EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.organization_membership_id=m.id AND h.status_code='Approved' AND (committee IS NULL OR h.committee_id=committee)) ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
REVOKE ALL ON FUNCTION lub.report_members(uuid,uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.report_members(uuid,uuid,int) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('lub-generated-documents','lub-generated-documents',false,2097152,ARRAY['text/html','text/csv']);
CREATE POLICY generated_document_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='lub-generated-documents' AND (lub.can_read_document_file(name) OR lub.can_upload_document(name)));
CREATE POLICY generated_document_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='lub-generated-documents' AND lub.can_upload_document(name));
CREATE POLICY generated_document_storage_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='lub-generated-documents' AND lub.can_upload_document(name));
REVOKE ALL ON FUNCTION lub.document_upload(uuid),lub.retry_document(uuid),lub.complete_document(uuid,uuid,boolean),lub.document_asset(uuid),lub.can_upload_document(text),lub.can_read_document_file(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.document_upload(uuid),lub.retry_document(uuid),lub.complete_document(uuid,uuid,boolean),lub.document_asset(uuid),lub.can_upload_document(text),lub.can_read_document_file(text) TO authenticated;
