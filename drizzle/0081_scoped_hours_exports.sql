-- Keep one test-account flag source; retain backwards-compatible historic references.
ALTER TABLE lub.users ADD COLUMN is_test boolean GENERATED ALWAYS AS (is_test_account) STORED;
DO $$ BEGIN
 IF (SELECT count(*) FROM lub.student_profiles WHERE lub.arabic_search_key(full_name_ar)=lub.arabic_search_key('مستخدم لُب التجريبي'))>1 THEN RAISE EXCEPTION 'Ambiguous test account'; END IF;
 UPDATE lub.users SET is_test_account=true WHERE id IN (SELECT user_id FROM lub.student_profiles WHERE lub.arabic_search_key(full_name_ar)=lub.arabic_search_key('مستخدم لُب التجريبي'));
END $$;
--> statement-breakpoint
CREATE TABLE lub.data_exports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid NOT NULL REFERENCES lub.users(id),organization_id uuid NOT NULL REFERENCES lub.organizations(id),
 kind text NOT NULL CHECK(kind IN('hours','registrants')), filters jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '5 minutes',used_at timestamptz
);
CREATE INDEX data_exports_owner_time_idx ON lub.data_exports(owner_user_id,created_at);
ALTER TABLE lub.data_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lub.data_exports FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.export_hours_rows(org uuid,committee uuid,term uuid,state text,query text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee))) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF query IS NULL OR length(query)>120 OR (state IS NOT NULL AND state NOT IN('Approved','Pending','Rejected')) OR (committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org)) OR (term IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.academic_terms WHERE id=term)) THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 SELECT jsonb_build_object('organization',o.name_ar,'slug',o.slug,'period',coalesce((SELECT academic_year||'-'||term_code FROM lub.academic_terms WHERE id=term),'all-terms'),'state',state,'records',coalesce((SELECT jsonb_agg(row ORDER BY row.name,row."userId") FROM (
  SELECT u.id AS "userId",p.full_name_ar AS name,p.university_id_ciphertext AS "universityCiphertext",false AS "isTest",sum(h.hours)::text AS hours,min(h.activity_date) AS "firstDate",max(h.activity_date) AS "lastDate"
  FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id
  WHERE h.organization_id=org AND lub.is_student_membership(m.id) AND NOT u.is_test
    AND (committee IS NULL OR h.committee_id=committee) AND (term IS NULL OR h.academic_term_id=term)
    AND (state IS NULL OR h.status_code=state) AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(p.full_name_ar))>0
  GROUP BY u.id,p.full_name_ar,p.university_id_ciphertext ORDER BY p.full_name_ar,u.id LIMIT 5001
 ) row),'[]'::jsonb)) INTO result FROM lub.organizations o WHERE o.id=org;
 IF result IS NULL OR jsonb_array_length(result->'records')>5000 THEN RAISE EXCEPTION 'Export unavailable'; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.export_hours_rows(uuid,uuid,uuid,text,text),public.export_hours_rows(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
CREATE FUNCTION public.prepare_hours_export(org uuid,committee uuid,term uuid,state text,query text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ticket uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee))) OR query IS NULL OR length(query)>120 OR (state IS NOT NULL AND state NOT IN('Approved','Pending','Rejected')) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('data-export:'||auth.uid()::text,0));
 IF (SELECT count(*) FROM lub.data_exports WHERE owner_user_id=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=6 THEN RAISE EXCEPTION 'Export rate limit' USING ERRCODE='54000'; END IF;
 INSERT INTO lub.data_exports(owner_user_id,organization_id,kind,filters) VALUES(auth.uid(),org,'hours',jsonb_build_object('committee',committee,'term',term,'state',state,'query',trim(query))) RETURNING id INTO ticket;
 RETURN jsonb_build_object('ticket',ticket);
END; $$;
CREATE FUNCTION public.consume_hours_export(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ticket lub.data_exports;payload jsonb;
BEGIN
 SELECT * INTO ticket FROM lub.data_exports WHERE id=target AND owner_user_id=auth.uid() AND kind='hours' FOR UPDATE;
 IF ticket.id IS NULL OR ticket.used_at IS NOT NULL OR ticket.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Export expired or unavailable' USING ERRCODE='42501'; END IF;
 payload:=lub.export_hours_rows(ticket.organization_id,(ticket.filters->>'committee')::uuid,(ticket.filters->>'term')::uuid,ticket.filters->>'state',ticket.filters->>'query');
 UPDATE lub.data_exports SET used_at=clock_timestamp() WHERE id=target;
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id) VALUES(auth.uid(),'HOURS_XLSX_EXPORTED','hours_export',target,ticket.organization_id);
 RETURN payload;
END; $$;
REVOKE ALL ON FUNCTION public.prepare_hours_export(uuid,uuid,uuid,text,text),public.consume_hours_export(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_hours_export(uuid,uuid,uuid,text,text),public.consume_hours_export(uuid) TO authenticated;

--> statement-breakpoint
create or replace function public.consume_member_export(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket lub.member_exports;directory jsonb;records jsonb;slug text;
begin
 select * into ticket from lub.member_exports where id=target and owner_user_id=auth.uid() for update;
 if ticket.id is null or ticket.used_at is not null or ticket.expires_at<=clock_timestamp() then raise exception 'Export expired or unavailable' using errcode='42501';end if;
 directory:=lub.organization_member_directory(ticket.organization_id,ticket.query,ticket.status,ticket.committee_id);
 if coalesce((directory->>'rowTotal')::int,(directory->'counts'->>'total')::int)>jsonb_array_length(directory->'members') then raise exception 'Refine filters before exporting' using errcode='22023';end if;
 select coalesce(jsonb_agg(
 jsonb_build_object('isTest',u.is_test,'userId',m.user_id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'universityCiphertext',p.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,
 'startDate',coalesce((select min(e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined')),(select min(history.start_date) from lub.organization_memberships history where history.user_id=m.user_id and history.organization_id=m.organization_id)),
 'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and h.status_code='Approved'),0),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code)) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
 'committees',coalesce((select jsonb_agg(jsonb_build_object('name',c.name) order by c.name) from lub.committees c where c.organization_id=m.organization_id and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and cm.committee_id=c.id)),'[]'::jsonb)
 ) order by p.full_name_ar,m.id),'[]'::jsonb) into records
 from jsonb_array_elements(directory->'members') member join lub.organization_memberships m on m.id=(member->>'id')::uuid join lub.users u on u.id=m.user_id and not u.is_test join lub.student_profiles p on p.user_id=m.user_id left join lub.private_student_identifiers n on n.user_id=m.user_id;
 select o.slug into slug from lub.organizations o where o.id=ticket.organization_id;
 update lub.member_exports set used_at=clock_timestamp(),row_count=jsonb_array_length(records) where id=target;
 return jsonb_build_object('records',records,'slug',slug,'filter',lower(ticket.status)||case when ticket.committee_id is not null then '-committee' else '' end||case when ticket.query<>'' then '-search' else '' end);
end;$$;


--> statement-breakpoint
CREATE FUNCTION lub.is_counted_student(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.users WHERE id=target AND NOT is_test) AND lub.is_student_account(target);
$$;
REVOKE ALL ON FUNCTION lub.is_counted_student(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.is_counted_student(uuid) TO authenticated;
-- SECURITY INVOKER deliberately preserves hour-record RLS for every reader and scope.
CREATE FUNCTION lub.hours_summary(org uuid,committee uuid,term uuid,state text,query text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 WITH filtered AS MATERIALIZED (
  SELECT h.hours,h.status_code,m.user_id FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  WHERE h.organization_id=org AND lub.is_counted_student(m.user_id)
   AND (committee IS NULL OR h.committee_id=committee) AND (term IS NULL OR h.academic_term_id=term)
   AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(lub.hour_owner_name(h.id)))>0
 ), per_status AS (SELECT user_id,status_code,round(sum(hours)) AS hours FROM filtered GROUP BY user_id,status_code),
 selected AS (SELECT user_id,round(sum(hours)) AS hours FROM filtered WHERE state IS NULL OR status_code=state GROUP BY user_id)
 SELECT jsonb_build_object('total',coalesce((SELECT sum(hours) FROM per_status WHERE status_code='Approved'),0)::text,
  'filteredTotal',coalesce((SELECT sum(hours) FROM selected),0)::text,'filteredCount',(SELECT count(*) FROM filtered WHERE state IS NULL OR status_code=state),
  'hoursByStatus',jsonb_build_object(
   'approved',coalesce((SELECT sum(hours) FROM per_status WHERE status_code='Approved'),0)::text,
   'pending',coalesce((SELECT sum(hours) FROM per_status WHERE status_code='Pending'),0)::text,
   'rejected',coalesce((SELECT sum(hours) FROM per_status WHERE status_code='Rejected'),0)::text,
   'approvedCount',(SELECT count(*) FROM filtered WHERE status_code='Approved'),
   'pendingCount',(SELECT count(*) FROM filtered WHERE status_code='Pending'),
   'rejectedCount',(SELECT count(*) FROM filtered WHERE status_code='Rejected')));
$$;
REVOKE ALL ON FUNCTION lub.hours_summary(uuid,uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.hours_summary(uuid,uuid,uuid,text,text) TO authenticated;
