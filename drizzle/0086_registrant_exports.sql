-- One event per export; report scope is checked again when the single-use ticket is consumed.
CREATE FUNCTION lub.registrant_export_rows(org uuid,event uuid,committee uuid,query text,state text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE whole boolean;scopes uuid[];payload jsonb;
BEGIN
 whole:=lub.has_org_permission(org,'REPORTS_GENERATE');
 SELECT coalesce(array_agg(c.id),'{}') INTO scopes FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'REPORTS_GENERATE',c.id);
 IF auth.uid() IS NULL OR (NOT whole AND cardinality(scopes)=0) OR (committee IS NOT NULL AND NOT(committee=ANY(scopes))) OR NOT EXISTS(SELECT 1 FROM lub.events WHERE id=event AND organization_id=org) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 IF query IS NULL OR length(query)>120 OR state IS NULL OR state NOT IN('','Pending','Accepted','Recorded','Rejected') THEN RAISE EXCEPTION 'Invalid filters';END IF;
 WITH filtered AS MATERIALIZED (
  SELECT r.*,EXISTS(SELECT 1 FROM lub.event_contributions c WHERE c.event_id=r.event_id AND c.user_id=r.user_id) AS recorded
  FROM lub.event_registrations r JOIN lub.student_profiles p ON p.user_id=r.user_id JOIN lub.users u ON u.id=r.user_id
  WHERE r.event_id=event AND r.status_code='Registered' AND r.review_status_code='Accepted' AND NOT u.is_test AND lub.is_student_account(u.id)
   AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(p.full_name_ar))>0
   AND ((whole AND committee IS NULL) OR EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id WHERE m.user_id=r.user_id AND m.organization_id=org AND cm.committee_id=ANY(scopes) AND (committee IS NULL OR cm.committee_id=committee)))
 ), selected AS(SELECT * FROM filtered WHERE state='' OR (state='Accepted' AND NOT recorded) OR (state='Recorded' AND recorded))
 SELECT jsonb_build_object('slug',o.slug,'eventId',e.id,'eventTitle',e.title,'records',coalesce((SELECT jsonb_agg(row ORDER BY row.name,row."userId") FROM (
  SELECT u.id AS "userId",false AS "isTest",p.full_name_ar AS name,p.university_id_ciphertext AS "universityCiphertext",n.national_id_ciphertext AS "nationalCiphertext",u.phone,u.email,p.major_name AS major,p.academic_level AS level,(r.registered_at AT TIME ZONE 'Asia/Riyadh')::date AS "registeredDate",CASE WHEN r.recorded THEN 'Recorded' ELSE 'Accepted' END AS status,e.attendance_hours AS hours
  FROM selected r JOIN lub.users u ON u.id=r.user_id JOIN lub.student_profiles p ON p.user_id=r.user_id LEFT JOIN lub.private_student_identifiers n ON n.user_id=r.user_id
 ) row),'[]')) INTO payload FROM lub.organizations o JOIN lub.events e ON e.organization_id=o.id WHERE o.id=org AND e.id=event;
 IF jsonb_array_length(payload->'records')>5000 THEN RAISE EXCEPTION 'Refine export filters';END IF;
 RETURN payload;
END; $$;
REVOKE ALL ON FUNCTION lub.registrant_export_rows(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.prepare_registrant_export(org uuid,event uuid,committee uuid,query text,state text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ticket uuid;
BEGIN
 -- Validate both scope and requested filters before reserving quota, without releasing PII.
 PERFORM lub.registrant_export_rows(org,event,committee,query,state);
 PERFORM pg_advisory_xact_lock(hashtextextended('data-export:'||auth.uid()::text,0));
 IF (SELECT count(*) FROM lub.data_exports WHERE owner_user_id=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=6 THEN RAISE EXCEPTION 'Export rate limit' USING ERRCODE='54000';END IF;
 INSERT INTO lub.data_exports(owner_user_id,organization_id,kind,filters) VALUES(auth.uid(),org,'registrants',jsonb_build_object('event',event,'committee',committee,'query',query,'state',state)) RETURNING id INTO ticket;
 RETURN jsonb_build_object('ticket',ticket);
END; $$;
CREATE FUNCTION public.consume_registrant_export(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ticket lub.data_exports;payload jsonb;
BEGIN
 SELECT * INTO ticket FROM lub.data_exports WHERE id=target AND owner_user_id=auth.uid() AND kind='registrants' FOR UPDATE;
 IF ticket.id IS NULL OR ticket.used_at IS NOT NULL OR ticket.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Export expired or unavailable' USING ERRCODE='42501';END IF;
 payload:=lub.registrant_export_rows(ticket.organization_id,(ticket.filters->>'event')::uuid,(ticket.filters->>'committee')::uuid,ticket.filters->>'query',ticket.filters->>'state');
 UPDATE lub.data_exports SET used_at=clock_timestamp() WHERE id=target;
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id) VALUES(auth.uid(),'REGISTRANTS_XLSX_EXPORTED','registrant_export',target,ticket.organization_id);
 RETURN payload;
END; $$;
REVOKE ALL ON FUNCTION public.prepare_registrant_export(uuid,uuid,uuid,text,text),public.consume_registrant_export(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_registrant_export(uuid,uuid,uuid,text,text),public.consume_registrant_export(uuid) TO authenticated;
