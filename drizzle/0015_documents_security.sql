CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;
-- Bounded immutable exports: one atomic generation, no Storage upload race.
CREATE FUNCTION lub.has_reports_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'REPORTS_GENERATE') OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'REPORTS_GENERATE',c.id));
$$;
CREATE FUNCTION lub.can_read_document(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.generated_documents d JOIN lub.users u ON u.id=auth.uid() WHERE d.id=target AND u.status_code='Active' AND (d.subject_user_id=u.id OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id)));
$$;
GRANT SELECT ON lub.generated_documents TO authenticated;
CREATE POLICY generated_documents_read ON lub.generated_documents FOR SELECT TO authenticated USING(lub.can_read_document(id));
CREATE POLICY generated_assets_read ON lub.assets FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lub.generated_documents d WHERE d.asset_id=assets.id AND lub.can_read_document(d.id)));
CREATE TRIGGER generated_assets_immutable BEFORE UPDATE OR DELETE ON lub.assets FOR EACH ROW EXECUTE FUNCTION lub.guard_task_revision();
CREATE FUNCTION lub.guard_generated_document() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status_code','archived_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status_code','archived_at']) OR NOT(OLD.status_code='Ready' AND NEW.status_code='Archived') THEN RAISE EXCEPTION 'Document history is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER generated_documents_immutable BEFORE UPDATE OR DELETE ON lub.generated_documents FOR EACH ROW EXECUTE FUNCTION lub.guard_generated_document();
CREATE FUNCTION lub.document_audit(target uuid,org uuid,action text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id) VALUES(auth.uid(),action,'generated_document',target,org);
$$;
CREATE FUNCTION lub.export_html(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT replace(replace(replace(replace(replace(coalesce(value,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');
$$;
CREATE FUNCTION lub.export_csv(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT '"'||replace(CASE WHEN coalesce(value,'') ~ '^[[:space:][:cntrl:]]*[=+@-]' OR left(value,1) IN(chr(9),chr(10),chr(13)) THEN ''''||value ELSE coalesce(value,'') END,'"','""')||'"';
$$;
CREATE FUNCTION lub.generate_document(org uuid,committee uuid,kind text,member uuid,period text,period_value text,starts date,ends date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid:=gen_random_uuid();asset uuid:=gen_random_uuid();subject uuid;term uuid;period_label text;org_name text;scope_name text;data jsonb;template jsonb;content text;mime text;filename text;table_rows text;title text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR lub.has_org_permission(org,'REPORTS_GENERATE',committee)) OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Report permission required' USING ERRCODE='42501'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Invalid committee'; END IF;
 IF kind NOT IN('Hours_Report','Hours_Certificate') OR kind IS NULL OR (kind='Hours_Certificate') IS DISTINCT FROM (member IS NOT NULL) THEN RAISE EXCEPTION 'Invalid document kind'; END IF;
 IF member IS NOT NULL THEN
  SELECT user_id INTO subject FROM lub.organization_memberships WHERE id=member AND organization_id=org;
  IF subject IS NULL THEN RAISE EXCEPTION 'Member mismatch'; END IF;
 END IF;
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
 -- A single MVCC snapshot supplies provenance and totals. Refuse oversize work,
 -- never silently truncate an export. Split periods above 5,000 hour records.
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,h.academic_term_id,p.full_name_ar AS name
  FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.academic_terms t ON t.id=h.academic_term_id
  WHERE h.organization_id=org AND h.status_code='Approved' AND (committee IS NULL OR h.committee_id=committee) AND (member IS NULL OR m.id=member) AND (starts IS NULL OR h.activity_date BETWEEN starts AND ends) AND (term IS NULL OR h.academic_term_id=term) AND (period<>'Year' OR t.academic_year=period_value)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,min(activity_date) AS first_date,max(activity_date) AS last_date FROM selected GROUP BY organization_membership_id,name
 ) SELECT jsonb_build_object('organization',org_name,'scope',coalesce(scope_name,'الجهة بالكامل'),'period',period_label,'periodKind',period,'periodStart',starts,'periodEnd',ends,'total',coalesce((SELECT sum(hours) FROM selected),0)::text,'recordCount',(SELECT count(*) FROM selected),'rows',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.name,g.organization_membership_id) FROM grouped g),'[]'::jsonb),'records',coalesce((SELECT jsonb_agg(to_jsonb(s)-'name' ORDER BY s.activity_date,s.id) FROM selected s),'[]'::jsonb)) INTO data;
 IF (data->>'recordCount')::int=0 THEN RAISE EXCEPTION 'No approved hours in period'; END IF;
 IF (data->>'recordCount')::int>5000 THEN RAISE EXCEPTION 'Export too large; split period'; END IF;
 title:=CASE WHEN kind='Hours_Certificate' THEN 'بيان الساعات التطوعية' ELSE 'تقرير الساعات المعتمدة' END;
 template:=jsonb_build_object('version',1,'title',title,'footer','أُعدّ هذا المستند في لُبّ من الساعات المعتمدة وقت الإصدار. موافقة الجامعة والتوقيع الخارجي خارج النظام.','language','ar','direction','rtl','columns',jsonb_build_array('الاسم','الساعات المعتمدة','عدد السجلات','أول نشاط','آخر نشاط'));
 IF kind='Hours_Report' THEN
  SELECT string_agg(lub.export_csv(org_name)||','||lub.export_csv(data->>'scope')||','||lub.export_csv(period_label)||','||lub.export_csv(r->>'name')||','||lub.export_csv(r->>'hours')||','||lub.export_csv(r->>'records')||','||lub.export_csv(r->>'first_date')||','||lub.export_csv(r->>'last_date'),chr(13)||chr(10) ORDER BY n) INTO table_rows FROM jsonb_array_elements(data->'rows') WITH ORDINALITY x(r,n);
  content:=chr(65279)||'"الجهة","النطاق","الفترة","الاسم","الساعات المعتمدة","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||table_rows||chr(13)||chr(10)||lub.export_csv(org_name)||','||lub.export_csv(data->>'scope')||','||lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(data->>'total')||','||lub.export_csv(data->>'recordCount')||',"",""'||chr(13)||chr(10);
  mime:='text/csv';filename:='report-'||result||'.csv';
 ELSE
  SELECT string_agg('<tr><td>'||lub.export_html(r->>'name')||'</td><td>'||lub.export_html(r->>'hours')||'</td><td>'||lub.export_html(r->>'records')||'</td><td>'||lub.export_html(r->>'first_date')||'</td><td>'||lub.export_html(r->>'last_date')||'</td></tr>','' ORDER BY n) INTO table_rows FROM jsonb_array_elements(data->'rows') WITH ORDINALITY x(r,n);
  content:='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'||lub.export_html(title)||'</title><style>body{font-family:Tahoma,Arial,sans-serif;color:#132d46;margin:0;padding:24px;line-height:1.9}main{max-width:900px;margin:auto}h1{font-size:28px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #d5e0e5;text-align:right;overflow-wrap:anywhere}footer{margin-top:32px;font-size:13px}@page{size:A4;margin:18mm}@media(max-width:500px){table{font-size:12px}td,th{padding:4px}}@media print{body{padding:0}tr{break-inside:avoid}thead{display:table-header-group}}</style></head><body><main><p>لُبّ · '||lub.export_html(org_name)||'</p><h1>'||lub.export_html(title)||'</h1><p>'||lub.export_html(data->>'scope')||' · '||lub.export_html(period_label)||'</p><p>إجمالي الساعات المعتمدة: <strong>'||lub.export_html(data->>'total')||'</strong></p><table><thead><tr><th>الاسم</th><th>الساعات المعتمدة</th><th>عدد السجلات</th><th>أول نشاط</th><th>آخر نشاط</th></tr></thead><tbody>'||table_rows||'</tbody></table><footer><p>'||lub.export_html(template->>'footer')||'</p><p>رقم المستند: '||result||'<br>تاريخ الإصدار: '||to_char(statement_timestamp() AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI')||' (الرياض)</p></footer></main></body></html>';
  mime:='text/html';filename:='certificate-'||result||'.html';
 END IF;
 INSERT INTO lub.assets(id,uploaded_by_user_id,storage_key,original_name,mime_type,size_bytes,checksum_sha256,body) VALUES(asset,auth.uid(),'documents/'||filename,filename,mime,octet_length(content),encode(sha256(convert_to(content,'UTF8')),'hex'),content);
 INSERT INTO lub.generated_documents(id,organization_id,committee_id,document_type_code,subject_user_id,academic_term_id,period_start,period_end,asset_id,data_snapshot_json,template_snapshot_json,generated_by_user_id) VALUES(result,org,committee,kind,subject,term,starts,ends,asset,data,template,auth.uid());
 PERFORM lub.document_audit(result,org,'DOCUMENT_GENERATED');RETURN result;
END; $$;
CREATE FUNCTION lub.archive_document(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d lub.generated_documents;
BEGIN
 SELECT * INTO d FROM lub.generated_documents WHERE id=target FOR UPDATE;
 IF d.id IS NULL OR NOT(lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') OR lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id)) THEN RAISE EXCEPTION 'Report permission required' USING ERRCODE='42501'; END IF;
 IF d.status_code<>'Ready' THEN RAISE EXCEPTION 'Invalid state'; END IF;
 UPDATE lub.generated_documents SET status_code='Archived',archived_at=clock_timestamp() WHERE id=target;
 PERFORM lub.document_audit(target,d.organization_id,'DOCUMENT_ARCHIVED');
END; $$;
CREATE FUNCTION lub.document_asset(target uuid) RETURNS TABLE(body text,mime_type text,original_name text,checksum_sha256 text,size_bytes int) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 IF NOT lub.can_read_document(target) THEN RAISE EXCEPTION 'Document unavailable' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM lub.generated_documents WHERE id=target;PERFORM lub.document_audit(target,org,'DOCUMENT_ACCESSED');
 RETURN QUERY SELECT a.body,a.mime_type::text,a.original_name::text,a.checksum_sha256::text,a.size_bytes FROM lub.assets a JOIN lub.generated_documents d ON d.asset_id=a.id WHERE d.id=target;
END; $$;
CREATE FUNCTION lub.report_members(org uuid,committee uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE m.organization_id=org AND (lub.has_org_permission(org,'REPORTS_GENERATE') OR lub.has_org_permission(org,'REPORTS_GENERATE',committee)) AND EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.organization_membership_id=m.id AND h.status_code='Approved' AND (committee IS NULL OR h.committee_id=committee)) ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
CREATE FUNCTION lub.grant_report_permission(member uuid,committee uuid,ends timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF ends IS NOT NULL AND ends<=statement_timestamp() THEN RAISE EXCEPTION 'Invalid expiry'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=member AND cm.committee_id=committee AND c.organization_id=org AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) THEN RAISE EXCEPTION 'Committee mismatch'; END IF;
 INSERT INTO lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,committee,'REPORTS_GENERATE',ends,auth.uid());PERFORM lub.task_audit(member,org,'REPORT_PERMISSION_GRANTED');
END; $$;
CREATE FUNCTION lub.end_report_permission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.permission_grants WHERE id=target AND permission_code='REPORTS_GENERATE' FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 UPDATE lub.permission_grants SET end_at=clock_timestamp() WHERE id=target AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp());PERFORM lub.task_audit(target,org,'REPORT_PERMISSION_ENDED');
END; $$;
CREATE FUNCTION lub.report_grants(org uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT g.id,p.full_name_ar AS name,g.committee_id,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE g.organization_id=org AND g.permission_code='REPORTS_GENERATE' AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND lub.has_org_permission(org,'PERMISSIONS_GRANT') ORDER BY g.start_at DESC,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) x;
$$;
CREATE FUNCTION lub.report_grant_members(org uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE m.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND lub.has_org_permission(org,'PERMISSIONS_GRANT') ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
REVOKE ALL ON FUNCTION lub.has_reports_access(uuid),lub.can_read_document(uuid),lub.guard_generated_document(),lub.document_audit(uuid,uuid,text),lub.export_html(text),lub.export_csv(text),lub.generate_document(uuid,uuid,text,uuid,text,text,date,date),lub.archive_document(uuid),lub.document_asset(uuid),lub.report_members(uuid,uuid,int),lub.grant_report_permission(uuid,uuid,timestamptz),lub.end_report_permission(uuid),lub.report_grants(uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.has_reports_access(uuid),lub.can_read_document(uuid),lub.generate_document(uuid,uuid,text,uuid,text,text,date,date),lub.archive_document(uuid),lub.document_asset(uuid),lub.report_members(uuid,uuid,int),lub.grant_report_permission(uuid,uuid,timestamptz),lub.end_report_permission(uuid),lub.report_grants(uuid,int) TO authenticated;
REVOKE ALL ON FUNCTION lub.report_grant_members(uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.report_grant_members(uuid,int) TO authenticated;
