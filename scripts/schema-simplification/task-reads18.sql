-- Shared task list scope is checked before any participant or submission is projected.
CREATE FUNCTION lub.task_workspace(org uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('name',o.name_ar,'scopes',coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',scope.id,'name',scope.name) ORDER BY scope.id IS NOT NULL,scope.name,scope.id)
  FROM (
   SELECT NULL::uuid AS id,'الجهة بالكامل'::text AS name WHERE lub.has_org_permission(org,'TASKS_MANAGE')
   UNION ALL SELECT c.id,c.name FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'TASKS_MANAGE',c.id)
  ) scope
 ),'[]'))
 FROM lub.organizations o WHERE o.id=org AND lub.has_task_access(org);
$$;

CREATE FUNCTION lub.task_list_scope(target_org uuid,view_mode text) RETURNS TABLE(task_id uuid,participation_id uuid,can_manage boolean,historical boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id,p.id,lub.can_manage_task(t.id),
  t.deleted_at IS NOT NULL OR (p.id IS NOT NULL AND NOT lub.task_scope_member(t.organization_id,t.committee_id) AND NOT lub.can_manage_task(t.id))
 FROM lub.tasks t LEFT JOIN lub.task_participants p ON p.task_id=t.id AND p.user_id=auth.uid()
 WHERE lub.is_student_account(auth.uid()) AND (target_org IS NULL OR t.organization_id=target_org) AND (
  (view_mode='all' AND target_org IS NOT NULL AND lub.can_manage_task(t.id))
  OR (view_mode='mine' AND p.id IS NOT NULL AND (p.withdrawn_at IS NULL OR t.deleted_at IS NOT NULL))
  OR (view_mode='available' AND t.status_code='Open' AND t.deleted_at IS NULL AND (t.starts_at IS NULL OR t.starts_at<=statement_timestamp())
   AND (lub.task_scope_member(t.organization_id,t.committee_id) OR lub.can_manage_task(t.id)))
 );
$$;

CREATE FUNCTION lub.task_participation_item(p lub.task_participants) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id',p.id,'user_id',p.user_id,
  'status_code',p.status_code,'joined_at',p.joined_at,'withdrawn_at',p.withdrawn_at,'closed_at',p.closed_at,
  'approved_hours_override',p.approved_hours_override::text) END;
$$;

CREATE FUNCTION lub.task_counts(target uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('participants',count(*) FILTER(WHERE p.status_code<>'Closed'),
  'submitted',count(*) FILTER(WHERE p.status_code IN ('Submitted','Approved')))
 FROM lub.task_participants p JOIN lub.users u ON u.id=p.user_id AND NOT u.is_test_account
 WHERE p.task_id=target AND lub.is_student_account(u.id);
$$;

CREATE FUNCTION lub.task_card_page(org uuid,view_mode text,page integer,query text,status text,ascending boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH selected AS MATERIALIZED (
  SELECT t,o.name_ar AS org_name,s.can_manage,s.historical,
   CASE WHEN view_mode='available' AND p.withdrawn_at IS NOT NULL THEN NULL ELSE p END AS participation
  FROM lub.task_list_scope(org,view_mode) s JOIN lub.tasks t ON t.id=s.task_id JOIN lub.organizations o ON o.id=t.organization_id
  LEFT JOIN lub.task_participants p ON p.id=s.participation_id
  WHERE (coalesce(status,'')='' OR t.status_code=status)
   AND position(lub.arabic_search_key(left(coalesce(query,''),120)) IN lub.arabic_search_key(t.title||' '||o.name_ar))>0
  ORDER BY CASE WHEN ascending THEN t.created_at END ASC,CASE WHEN NOT ascending THEN t.created_at END DESC,t.id
  LIMIT CASE WHEN page IS NULL THEN 51 ELSE 26 END OFFSET (least(greatest(page,0),10000)*25)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'task',jsonb_build_object('id',(t).id,'organization_id',(t).organization_id,'committee_id',(t).committee_id,
   'title',(t).title,'starts_at',(t).starts_at,'due_at',(t).due_at,'default_hours',(t).default_hours::text,
   'status_code',(t).status_code,'revision',(t).revision,'image_asset_id',(t).image_asset_id,'event_id',linked.id,'has_event_poster',linked.primary_image_id IS NOT NULL),
  'org_name',org_name,'can_manage',can_manage,'historical',historical,
  'participant',lub.task_participation_item(participation),
  'summary',lub.task_counts((t).id),
  'latest_submission',(SELECT jsonb_build_object('status_code',s->>'status_code') FROM jsonb_array_elements((participation).submissions) s
    ORDER BY (s->>'revision_number')::int DESC LIMIT 1),
  'approved_hours',(SELECT h->>'hours' FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
    WHERE m.id=(participation).organization_membership_id AND h->>'source_code'='TASK' AND h->>'source_id'=(participation).id::text AND h->>'status_code'='Approved' LIMIT 1)
 ) ORDER BY CASE WHEN ascending THEN (t).created_at END ASC,CASE WHEN NOT ascending THEN (t).created_at END DESC,(t).id),'[]')
 FROM selected LEFT JOIN LATERAL (
  SELECT e.id,e.primary_image_id FROM lub.organization_content e WHERE e.id=(t).event_id AND e.deleted_at IS NULL
  AND (lub.content_is_public(e.id) OR (view_mode='all' AND lub.has_org_permission(e.organization_id,'EVENTS_MANAGE')))
 ) linked ON true;
$$;

CREATE FUNCTION lub.activity_fingerprint() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH visible_tasks AS MATERIALIZED (
  SELECT task_id FROM lub.task_list_scope(NULL,'mine')
  UNION SELECT task_id FROM lub.task_list_scope(NULL,'available')
 )
 SELECT md5(concat_ws('|',
  (SELECT jsonb_agg(jsonb_build_array(t.id,t.revision,t.status_code,o.name_ar,e.primary_image_id,e.revision) ORDER BY t.id)
   FROM visible_tasks v JOIN lub.tasks t ON t.id=v.task_id JOIN lub.organizations o ON o.id=t.organization_id
   LEFT JOIN lub.organization_content e ON e.id=t.event_id AND (lub.content_is_public(e.id) OR lub.has_org_permission(e.organization_id,'EVENTS_MANAGE'))),
  (SELECT jsonb_agg(jsonb_build_array(p.id,p.status_code) ORDER BY p.id) FROM lub.task_participants p JOIN visible_tasks v ON v.task_id=p.task_id),
  (SELECT jsonb_agg(jsonb_build_array(p.id,p.status_code,p.withdrawn_at,p.submissions) ORDER BY p.id) FROM lub.task_participants p WHERE p.user_id=auth.uid()),
  (SELECT jsonb_agg(jsonb_build_array(r.id,r.status_code,r.review_status_code,r.review_note,r.attendance,e.revision,e.starts_at) ORDER BY r.id)
   FROM lub.event_registrations r JOIN lub.organization_content e ON e.id=r.event_id WHERE r.user_id=auth.uid()),
  (SELECT jsonb_agg(jsonb_build_array(e.id,e.revision,e.starts_at>=statement_timestamp(),o.name_ar) ORDER BY e.id)
   FROM lub.organization_content e JOIN lub.organizations o ON o.id=e.organization_id WHERE e.kind='Event' AND lub.content_is_public(e.id)),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM lub.academic_terms t),
  (SELECT jsonb_agg(jsonb_build_array(m.id,m.status_code,m.start_date<=lub.today_riyadh(),m.end_date,m.end_date>lub.today_riyadh(),m.updated_at,o.name_ar,o.status_code,o.self_report_hours_enabled) ORDER BY m.id)
   FROM lub.organization_memberships m JOIN lub.organizations o ON o.id=m.organization_id WHERE m.user_id=auth.uid()),
  (SELECT jsonb_agg(jsonb_build_array(c.id,c.name,c.status_code,cm.status_code,cm.start_date<=lub.today_riyadh(),cm.end_date,cm.end_date>lub.today_riyadh()) ORDER BY cm.id)
   FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id
   JOIN lub.committees c ON c.id=cm.committee_id WHERE m.user_id=auth.uid())
 )) WHERE lub.is_student_account(auth.uid());
$$;

REVOKE ALL ON FUNCTION lub.task_list_scope(uuid,text),lub.task_workspace(uuid),lub.task_card_page(uuid,text,integer,text,text,boolean),lub.activity_fingerprint() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.task_workspace(uuid),lub.task_card_page(uuid,text,integer,text,text,boolean),lub.activity_fingerprint() TO authenticated;

CREATE FUNCTION lub.task_detail(target uuid,person uuid,management boolean,event_choices boolean,include_work boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH scope AS MATERIALIZED (
  SELECT t,o.name_ar,
   management AND lub.can_manage_task(t.id) AS manage,
   management AND lub.can_review_task(t.id) AS review,
   t.deleted_at IS NULL AND t.status_code<>'Draft' AND (lub.task_scope_member(t.organization_id,t.committee_id) OR lub.can_manage_task(t.id)) AS member_scope,
   own
  FROM lub.tasks t JOIN lub.organizations o ON o.id=t.organization_id
  LEFT JOIN lub.task_participants own ON own.task_id=t.id AND own.user_id=auth.uid()
  WHERE t.id=target AND lub.is_student_account(auth.uid())
 ), visible AS MATERIALIZED (
  SELECT *,manage OR member_scope AS current FROM scope WHERE manage OR member_scope OR (own).id IS NOT NULL
 )
 SELECT jsonb_build_object(
  'organizationName',v.name_ar,'asOf',statement_timestamp(),'canManage',v.manage,'canReview',v.review,'current',v.current,
  'task',jsonb_build_object('id',(v.t).id,'organization_id',(v.t).organization_id,'committee_id',(v.t).committee_id,
   'title',(v.t).title,'description',(v.t).description,'starts_at',(v.t).starts_at,'due_at',(v.t).due_at,
   'default_hours',(v.t).default_hours::text,'status_code',(v.t).status_code,'revision',(v.t).revision,
   'image_asset_id',(v.t).image_asset_id,'event_id',CASE WHEN linked.visible THEN linked.id END,
   'has_event_poster',coalesce(linked.visible AND linked.primary_image_id IS NOT NULL,false))
   || CASE WHEN v.manage THEN jsonb_build_object('skills',lub.activity_skill_items((v.t).skill_ids)) ELSE '{}'::jsonb END,
  'summary',CASE WHEN include_work AND v.manage THEN lub.task_counts(target) END,
  'own',CASE WHEN include_work THEN lub.task_participation_item(v.own) END,
  'selected',CASE WHEN include_work AND person IS NULL THEN lub.task_participation_item(v.own)
   WHEN include_work AND v.review THEN (SELECT lub.task_participation_item(p) FROM lub.task_participants p WHERE p.task_id=target AND p.id=person) END,
  'lastRevision',CASE WHEN include_work THEN coalesce((SELECT max((s->>'revision_number')::int) FROM jsonb_array_elements((v.own).submissions) s),0) ELSE 0 END,
  'linkedEvent',CASE WHEN v.manage AND linked.visible THEN jsonb_build_object('id',linked.id,'title',linked.title,'status',linked.status_code) END,
  'eventChoices',CASE WHEN event_choices AND v.manage THEN coalesce((
   SELECT jsonb_agg(e ORDER BY e.starts_at DESC NULLS LAST,e.id) FROM (
    SELECT id,title,status_code AS status,starts_at FROM lub.organization_content e
    WHERE e.organization_id=(v.t).organization_id AND e.kind='Event' AND e.deleted_at IS NULL AND e.archived_at IS NULL
     AND e.status_code<>'Cancelled' AND (lub.content_is_public(e.id) OR lub.has_org_permission(e.organization_id,'EVENTS_MANAGE'))
    ORDER BY starts_at DESC NULLS LAST,id LIMIT 1000
   ) e),'[]') ELSE '[]'::jsonb END,
  'team',CASE WHEN include_work AND v.current THEN coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',u.full_name_ar,'status',p.status_code,'joinedAt',p.joined_at,
    'isLeader',EXISTS(SELECT 1 FROM lub.access_assignments a JOIN lub.organization_memberships m ON m.id=a.organization_membership_id
     WHERE a.organization_id=p.organization_id AND a.user_id=p.user_id AND a.role_code='OL' AND m.status_code='Active'
      AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
      AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())),
    'committee',(SELECT string_agg(DISTINCT c.name,'، ' ORDER BY c.name)
     FROM lub.organization_memberships m JOIN lub.committee_memberships cm ON cm.organization_membership_id=m.id JOIN lub.committees c ON c.id=cm.committee_id
     WHERE m.user_id=p.user_id AND m.organization_id=p.organization_id AND m.status_code='Active'
      AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
      AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=lub.today_riyadh() AND (cm.end_date IS NULL OR cm.end_date>lub.today_riyadh())))
    ORDER BY p.joined_at DESC,p.id)
   FROM lub.task_participants p JOIN lub.users u ON u.id=p.user_id WHERE p.task_id=target AND lub.is_student_account(u.id)
  ),'[]') ELSE '[]'::jsonb END,
  'submissions',CASE WHEN include_work THEN coalesce((
   SELECT jsonb_agg((s-ARRAY['task_snapshot','attachments','reviewed_by_user_id'])||jsonb_build_object(
    'displayStatus',CASE WHEN s->>'review_decision_code'='Changes_Requested' THEN 'Changes_Requested' ELSE s->>'status_code' END,
    'name',u.full_name_ar,'major',CASE WHEN v.review THEN u.major_name END,'level',CASE WHEN v.review THEN u.academic_level END,
    'assets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name) ORDER BY f.ordinal)
     FROM jsonb_array_elements(s->'attachments') WITH ORDINALITY AS f(file,ordinal)
     JOIN lub.assets a ON a.id=(f.file->>'assetId')::uuid),'[]')) ORDER BY (s->>'submitted_at')::timestamptz DESC,s->>'id')
   FROM lub.task_participants p JOIN lub.users u ON u.id=p.user_id CROSS JOIN LATERAL jsonb_array_elements(p.submissions) s
   WHERE p.task_id=target AND (v.review OR p.user_id=auth.uid()) AND (person IS NULL OR (v.review AND p.id=person))
  ),'[]') ELSE '[]'::jsonb END
 )
 FROM visible v
 LEFT JOIN LATERAL (
  SELECT e.id,e.title,e.status_code,e.primary_image_id,lub.content_is_public(e.id) OR lub.has_org_permission(e.organization_id,'EVENTS_MANAGE') AS visible
  FROM lub.organization_content e WHERE e.id=(v.t).event_id AND e.deleted_at IS NULL
 ) linked ON true;
$$;

REVOKE ALL ON FUNCTION lub.task_counts(uuid),lub.task_participation_item(lub.task_participants),lub.task_detail(uuid,uuid,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.task_detail(uuid,uuid,boolean,boolean,boolean) TO authenticated;
