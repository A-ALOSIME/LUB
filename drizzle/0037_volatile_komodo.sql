-- Delete legacy individual-hour certificate files through the Supabase Storage API
-- in scripts/migrate.ts before removing their database metadata.
ALTER TABLE lub.generated_documents DISABLE TRIGGER generated_documents_immutable;
ALTER TABLE lub.assets DISABLE TRIGGER generated_assets_immutable;
DELETE FROM lub.generated_documents WHERE document_type_code='Hours_Certificate';
DELETE FROM lub.assets WHERE mime_type='text/html';
ALTER TABLE lub.generated_documents ENABLE TRIGGER generated_documents_immutable;
ALTER TABLE lub.assets ENABLE TRIGGER generated_assets_immutable;
--> statement-breakpoint

DROP FUNCTION lub.generate_document(uuid,uuid,text,uuid,text,text,date,date);
DROP FUNCTION lub.report_members(uuid,uuid,int);
DROP FUNCTION lub.export_html(text);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION lub.can_read_document(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM lub.generated_documents d JOIN lub.users u ON u.id=auth.uid()
  WHERE d.id=target AND d.document_type_code='Hours_Report' AND u.status_code='Active'
   AND (lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id))
 );
$$;
--> statement-breakpoint

CREATE FUNCTION lub.generate_document(org uuid,committee uuid,period text,period_value text,starts date,ends date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid:=gen_random_uuid();asset uuid:=gen_random_uuid();term uuid;period_label text;org_name text;scope_name text;data jsonb;template jsonb;content text;filename text;table_rows text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR lub.has_org_permission(org,'REPORTS_GENERATE',committee)) OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Report permission required' USING ERRCODE='42501'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Invalid committee'; END IF;
 IF period='Term' THEN
  SELECT id,start_date,end_date,name_ar INTO term,starts,ends,period_label FROM lub.academic_terms WHERE id=period_value::uuid;
  IF term IS NULL THEN RAISE EXCEPTION 'Unknown term'; END IF;
 ELSIF period='Year' THEN
  SELECT min(start_date),max(end_date) INTO starts,ends FROM lub.academic_terms WHERE academic_year=period_value;
  IF starts IS NULL THEN RAISE EXCEPTION 'Unknown year'; END IF;period_label:='السنة الأكاديمية '||period_value;
 ELSIF period='Custom' THEN
  IF starts IS NULL OR ends IS NULL OR ends<starts THEN RAISE EXCEPTION 'Invalid period'; END IF;period_label:=starts::text||' — '||ends::text;
 ELSIF period='All' THEN starts:=NULL;ends:=NULL;period_label:='كل التاريخ';
 ELSE RAISE EXCEPTION 'Invalid period'; END IF;
 SELECT name_ar INTO org_name FROM lub.organizations WHERE id=org;
 SELECT name INTO scope_name FROM lub.committees WHERE id=committee;
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,h.academic_term_id,p.full_name_ar AS name
  FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.academic_terms t ON t.id=h.academic_term_id
  WHERE h.organization_id=org AND h.status_code='Approved' AND (committee IS NULL OR h.committee_id=committee) AND (starts IS NULL OR h.activity_date BETWEEN starts AND ends) AND (term IS NULL OR h.academic_term_id=term) AND (period<>'Year' OR t.academic_year=period_value)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,min(activity_date) AS first_date,max(activity_date) AS last_date FROM selected GROUP BY organization_membership_id,name
 )
 SELECT jsonb_build_object('organization',org_name,'scope',coalesce(scope_name,'الجهة بالكامل'),'period',period_label,'periodKind',period,'periodStart',starts,'periodEnd',ends,'total',coalesce((SELECT sum(hours) FROM selected),0)::text,'recordCount',(SELECT count(*) FROM selected),'rows',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.name,g.organization_membership_id) FROM grouped g),'[]'::jsonb),'records',coalesce((SELECT jsonb_agg(to_jsonb(s)-'name' ORDER BY s.activity_date,s.id) FROM selected s),'[]'::jsonb)) INTO data;
 IF (data->>'recordCount')::int=0 THEN RAISE EXCEPTION 'No approved hours in period'; END IF;
 IF (data->>'recordCount')::int>5000 THEN RAISE EXCEPTION 'Export too large; split period'; END IF;
 template:=jsonb_build_object('version',1,'title','تقرير الساعات المعتمدة','footer','تقرير داخلي من الساعات المعتمدة وقت الإصدار. موافقة الجامعة والتوقيع الخارجي خارج النظام.','language','ar','direction','rtl','columns',jsonb_build_array('الاسم','الساعات المعتمدة','عدد السجلات','أول نشاط','آخر نشاط'));
 SELECT string_agg(lub.export_csv(org_name)||','||lub.export_csv(data->>'scope')||','||lub.export_csv(period_label)||','||lub.export_csv(r->>'name')||','||lub.export_csv(r->>'hours')||','||lub.export_csv(r->>'records')||','||lub.export_csv(r->>'first_date')||','||lub.export_csv(r->>'last_date'),chr(13)||chr(10) ORDER BY n) INTO table_rows FROM jsonb_array_elements(data->'rows') WITH ORDINALITY x(r,n);
 content:=chr(65279)||'"الجهة","النطاق","الفترة","الاسم","الساعات المعتمدة","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||table_rows||chr(13)||chr(10)||lub.export_csv(org_name)||','||lub.export_csv(data->>'scope')||','||lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(data->>'total')||','||lub.export_csv(data->>'recordCount')||',"",""'||chr(13)||chr(10);
 filename:='report-'||result||'.csv';
 INSERT INTO lub.assets(id,uploaded_by_user_id,storage_key,original_name,mime_type,size_bytes,checksum_sha256,body) VALUES(asset,auth.uid(),'documents/'||filename,filename,'text/csv',octet_length(content),encode(sha256(convert_to(content,'UTF8')),'hex'),content);
 INSERT INTO lub.generated_documents(id,organization_id,committee_id,document_type_code,academic_term_id,period_start,period_end,asset_id,data_snapshot_json,template_snapshot_json,generated_by_user_id) VALUES(result,org,committee,'Hours_Report',term,starts,ends,asset,data,template,auth.uid());
 PERFORM lub.document_audit(result,org,'DOCUMENT_GENERATED');RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.generate_document(uuid,uuid,text,text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.generate_document(uuid,uuid,text,text,date,date) TO authenticated;
--> statement-breakpoint

UPDATE storage.buckets SET allowed_mime_types=ARRAY['text/csv'] WHERE id='lub-generated-documents';
--> statement-breakpoint

ALTER TABLE "lub"."assets" DROP CONSTRAINT "generated_asset_check";--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" DROP CONSTRAINT "document_kind_check";--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" DROP CONSTRAINT "generated_documents_subject_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "lub"."document_subject_time_idx";--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" DROP COLUMN "subject_user_id";--> statement-breakpoint
ALTER TABLE "lub"."assets" ADD CONSTRAINT "generated_asset_check" CHECK ("lub"."assets"."visibility_code"='Private' and "lub"."assets"."mime_type"='text/csv' and "lub"."assets"."size_bytes"=octet_length("lub"."assets"."body") and "lub"."assets"."size_bytes" between 1 and 2097152 and "lub"."assets"."checksum_sha256"=encode(sha256(convert_to("lub"."assets"."body",'UTF8')),'hex'));--> statement-breakpoint
ALTER TABLE "lub"."generated_documents" ADD CONSTRAINT "document_kind_check" CHECK ("lub"."generated_documents"."document_type_code"='Hours_Report');
