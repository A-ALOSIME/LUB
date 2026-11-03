-- Scope checks happen once per projection; no personal images or pre-signed files are fetched.
CREATE FUNCTION lub.task_people(target uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;adjust boolean;result jsonb;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target;
 IF t.id IS NULL OR NOT lub.can_manage_task(target) THEN RETURN '[]'::jsonb; END IF;
 adjust:=lub.can_approve_hours(t.organization_id,t.committee_id);
 SELECT coalesce(jsonb_agg(row ORDER BY row."joinedAt" DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT p.id,profile.full_name_ar AS name,profile.major_name AS major,profile.academic_level AS level,p.status_code AS status,p.joined_at AS "joinedAt",
   (SELECT jsonb_build_object('id',h.id,'hours',h.hours::text,'canAdjust',adjust AND h.status_code='Approved') FROM lub.hour_records h WHERE h.task_participant_id=p.id AND h.organization_id=t.organization_id LIMIT 1) AS "hourRecord"
  FROM lub.task_participants p JOIN lub.student_profiles profile ON profile.user_id=p.user_id WHERE p.task_id=target
  ORDER BY p.joined_at DESC,p.id LIMIT 26 OFFSET greatest(0,least(skip,250000))
 ) row;
 RETURN result;
END; $$;
CREATE FUNCTION lub.task_submission_page(target uuid,person uuid,skip int,management boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE manage boolean:=management AND lub.can_manage_task(target);result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(row ORDER BY row.submitted_at DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT s.*,CASE WHEN s.withdrawn_at IS NOT NULL THEN 'Withdrawn' WHEN s.review_decision_code='Changes_Requested' THEN 'Changes_Requested' ELSE s.status_code END AS "displayStatus",
   profile.full_name_ar AS name,profile.major_name AS major,profile.academic_level AS level,
   r.revision_number AS task_revision_number,r.snapshot_json AS task_snapshot,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name) ORDER BY a.id) FROM lub.task_submission_assets sa JOIN lub.application_assets a ON a.id=sa.asset_id WHERE sa.task_submission_id=s.id),'[]'::jsonb) AS assets
  FROM lub.task_submissions s JOIN lub.task_participants p ON p.id=s.task_participant_id JOIN lub.student_profiles profile ON profile.user_id=p.user_id JOIN lub.task_revisions r ON r.id=s.task_revision_id
  WHERE p.task_id=target AND (manage OR (p.user_id=auth.uid() AND lub.can_read_task_submission(s.id))) AND (person IS NULL OR (manage AND p.id=person))
  ORDER BY s.submitted_at DESC,s.id LIMIT 21 OFFSET greatest(0,least(skip,200000))
 ) row;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.task_people(uuid,int),lub.task_submission_page(uuid,uuid,int,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.task_people(uuid,int),lub.task_submission_page(uuid,uuid,int,boolean) TO authenticated;
