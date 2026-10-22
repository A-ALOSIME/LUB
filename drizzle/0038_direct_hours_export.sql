CREATE OR REPLACE FUNCTION lub.has_hours_export_access(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'REPORTS_GENERATE')
 OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'REPORTS_GENERATE',c.id));
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.has_hours_export_access(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lub.has_hours_export_access(uuid) TO authenticated;--> statement-breakpoint
CREATE FUNCTION lub.export_hours_csv(org uuid, committee uuid, term uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE organization_name text; scope_name text; period_label text; record_count integer; total text; table_rows text; content text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee)))
   OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Hours export permission required' USING ERRCODE='42501';
 END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN
  RAISE EXCEPTION 'Invalid committee';
 END IF;
 SELECT name_ar INTO organization_name FROM lub.organizations WHERE id=org;
 IF organization_name IS NULL THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 scope_name:='الجهة بالكامل';
 IF committee IS NOT NULL THEN SELECT name INTO scope_name FROM lub.committees WHERE id=committee; END IF;
 period_label:='كل التاريخ';
 IF term IS NOT NULL THEN
  SELECT name_ar||' · '||academic_year INTO period_label FROM lub.academic_terms WHERE id=term;
  IF period_label IS NULL THEN RAISE EXCEPTION 'Unknown academic term'; END IF;
 END IF;
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,p.full_name_ar AS name
  FROM lub.hour_records h
  JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.student_profiles p ON p.user_id=m.user_id
  WHERE h.organization_id=org AND h.status_code='Approved'
    AND (committee IS NULL OR h.committee_id=committee)
    AND (term IS NULL OR h.academic_term_id=term)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,
    min(activity_date)::text AS first_date,max(activity_date)::text AS last_date
  FROM selected GROUP BY organization_membership_id,name
 )
 SELECT (SELECT count(*)::int FROM selected),
   coalesce((SELECT sum(hours)::text FROM selected),'0'),
   coalesce((SELECT string_agg(
     lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||lub.export_csv(period_label)||','||
     lub.export_csv(g.name)||','||lub.export_csv(g.hours)||','||lub.export_csv(g.records::text)||','||
     lub.export_csv(g.first_date)||','||lub.export_csv(g.last_date),chr(13)||chr(10)
     ORDER BY g.name,g.organization_membership_id) FROM grouped g),'')
 INTO record_count,total,table_rows;
 IF record_count>5000 THEN RAISE EXCEPTION 'Export too large; select a term'; END IF;
 content:='"الجهة","النطاق","الفترة","الاسم","الساعات المعتمدة","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||
   table_rows||chr(13)||chr(10)||lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||
   lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(total)||','||lub.export_csv(record_count::text)||',"",""'||chr(13)||chr(10);
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id)
 VALUES(auth.uid(),'HOURS_CSV_EXPORTED','hours_export',org,org);
 RETURN content;
END; $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.export_hours_csv(uuid,uuid,uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lub.export_hours_csv(uuid,uuid,uuid) TO authenticated;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='lub-generated-documents') THEN
  RAISE EXCEPTION 'The generated-documents bucket must be emptied through Supabase Storage before this migration';
 END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='lub-generated-documents') THEN
  RAISE EXCEPTION 'The empty generated-documents bucket must be removed through Supabase Storage before this migration';
 END IF;
END $$;--> statement-breakpoint
DROP POLICY IF EXISTS generated_document_storage_read ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS generated_document_storage_insert ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS generated_document_storage_cleanup ON storage.objects;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.generate_document(uuid,uuid,text,uuid,text,text,date,date) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.generate_document(uuid,uuid,text,text,date,date) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.archive_document(uuid) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.can_read_document(uuid) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.can_read_document_file(text) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.can_upload_document(text) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.complete_document(uuid,uuid,boolean) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.document_asset(uuid) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.document_audit(uuid,uuid,text) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.document_upload(uuid) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.retry_document(uuid) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.has_reports_access(uuid) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.export_html(text) CASCADE;--> statement-breakpoint
DROP FUNCTION IF EXISTS lub.guard_generated_document() CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS lub.generated_documents CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS lub.assets CASCADE;
