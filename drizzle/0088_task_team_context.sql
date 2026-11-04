-- Keep team/participant projections scoped to the readable task and its organization.
CREATE OR REPLACE FUNCTION lub.task_people(target uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;adjust boolean;result jsonb;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target;
 IF t.id IS NULL OR NOT lub.can_manage_task(target) THEN RETURN '[]'::jsonb; END IF;
 adjust:=lub.can_approve_hours(t.organization_id,t.committee_id);
 SELECT coalesce(jsonb_agg(row ORDER BY row."joinedAt" DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT p.id,profile.full_name_ar AS name,profile.major_name AS major,profile.academic_level AS level,p.status_code AS status,p.joined_at AS "joinedAt",
   (SELECT string_agg(DISTINCT c.name,'، ' ORDER BY c.name) FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id JOIN lub.committees c ON c.id=cm.committee_id WHERE m.user_id=p.user_id AND m.organization_id=t.organization_id AND c.organization_id=t.organization_id AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) AS committee,
   (SELECT jsonb_build_object('id',h.id,'hours',h.hours::text,'canAdjust',adjust AND h.status_code='Approved') FROM lub.hour_records h WHERE h.task_participant_id=p.id AND h.organization_id=t.organization_id LIMIT 1) AS "hourRecord"
  FROM lub.task_participants p JOIN lub.student_profiles profile ON profile.user_id=p.user_id WHERE p.task_id=target
  ORDER BY p.joined_at DESC,p.id LIMIT 26 OFFSET greatest(0,least(skip,250000))
 ) row;
 RETURN result;
END; $$;
--> statement-breakpoint
CREATE FUNCTION lub.task_team_details(target uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;result jsonb;
BEGIN
 IF NOT lub.can_read_task(target) THEN RETURN '[]'::jsonb; END IF;
 SELECT organization_id INTO org FROM lub.tasks WHERE id=target;
 SELECT coalesce(jsonb_agg(row ORDER BY row."joinedAt" DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT p.id,profile.full_name_ar AS name,p.status_code AS status,p.joined_at AS "joinedAt",
   (SELECT string_agg(DISTINCT c.name,'، ' ORDER BY c.name) FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id JOIN lub.committees c ON c.id=cm.committee_id WHERE m.user_id=p.user_id AND m.organization_id=org AND c.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) AS committee
  FROM lub.task_participants p JOIN lub.student_profiles profile ON profile.user_id=p.user_id WHERE p.task_id=target
  ORDER BY p.joined_at DESC,p.id LIMIT 26 OFFSET greatest(0,least(skip,250000))
 ) row;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.task_team_details(uuid,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.task_team_details(uuid,int) TO authenticated;
NOTIFY pgrst,'reload schema';
