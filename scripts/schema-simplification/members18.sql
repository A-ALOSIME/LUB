-- Member scope, one row per student, and private record projection.
CREATE FUNCTION lub.member_committee_scope(org uuid,capability text) RETURNS uuid[]
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(array_agg(c.id),'{}'::uuid[]) FROM lub.committees c WHERE c.organization_id=org
 AND c.status_code='Active' AND lub.has_org_permission(org,capability,c.id);
$$;

CREATE FUNCTION lub.member_in_committees(org uuid,student uuid,scope uuid[]) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.committee_memberships cm ON cm.organization_membership_id=m.id
   WHERE m.organization_id=org AND m.user_id=student AND cm.committee_id=ANY(scope))
 OR EXISTS(SELECT 1 FROM lub.access_assignments a WHERE a.organization_id=org AND a.user_id=student AND a.committee_id=ANY(scope));
$$;

CREATE FUNCTION lub.member_approved_hours(org uuid,student uuid,term uuid,scope uuid[] DEFAULT NULL) RETURNS numeric
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(sum((h->>'hours')::numeric),0) FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
 WHERE m.organization_id=org AND m.user_id=student AND h->>'status_code'='Approved'
  AND (term IS NULL OR h->>'academic_term_id'=term::text) AND (scope IS NULL OR (h->>'committee_id')::uuid=ANY(scope));
$$;

CREATE FUNCTION lub.member_directory_rows(org uuid,search text,committee uuid,term uuid,for_export boolean)
RETURNS TABLE(member_id uuid,user_id uuid,status_code text,start_date date,end_date date,name text,major text,level text,is_test boolean)
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE capability text:=CASE WHEN for_export THEN 'REPORTS_GENERATE' ELSE 'MEMBERS_VIEW' END;
 wide boolean; scope uuid[]; period lub.academic_terms;
BEGIN
 wide:=lub.has_org_permission(org,capability);
 scope:=lub.member_committee_scope(org,capability);
 IF NOT wide AND cardinality(scope)=0 THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF length(coalesce(search,''))>120 THEN RAISE EXCEPTION 'Invalid member filters'; END IF;
 IF committee IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.id=committee AND c.organization_id=org)
  OR NOT(wide OR committee=ANY(scope))) THEN RAISE EXCEPTION 'Committee permission required' USING ERRCODE='42501'; END IF;
 IF term IS NOT NULL THEN
  SELECT * INTO period FROM lub.academic_terms WHERE id=term;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid term'; END IF;
 END IF;
 RETURN QUERY
 SELECT DISTINCT ON(m.user_id) m.id,m.user_id,m.status_code,m.start_date,m.end_date,u.full_name_ar::text,u.major_name::text,u.academic_level::text,u.is_test_account
 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id
 WHERE m.organization_id=org AND lub.is_student_account(m.user_id) AND (NOT for_export OR NOT u.is_test_account)
  AND (term IS NULL OR (m.start_date<=period.end_date AND (m.end_date IS NULL OR m.end_date>period.start_date)))
  AND (wide OR lub.member_in_committees(org,m.user_id,scope))
  AND (committee IS NULL OR lub.member_in_committees(org,m.user_id,ARRAY[committee]))
  AND (strpos(lub.arabic_search_key(u.full_name_ar||' '||u.major_name),lub.arabic_search_key(trim(search)))>0
    OR EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id
       JOIN lub.organization_memberships history ON history.id=cm.organization_membership_id
       WHERE history.user_id=m.user_id AND history.organization_id=org AND (wide OR c.id=ANY(scope))
       AND strpos(lub.arabic_search_key(c.name),lub.arabic_search_key(trim(search)))>0))
 ORDER BY m.user_id,(m.status_code='Active') DESC,m.start_date DESC,m.id;
END; $$;

CREATE FUNCTION lub.organization_member_directory(org uuid,search text,state text,committee uuid,skip integer,ordering text,term uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF state IS NULL OR state NOT IN ('all','Active','Ended','Inactive') OR ordering IS NULL OR ordering NOT IN ('name:asc','name:desc','date:asc','date:desc')
 THEN RAISE EXCEPTION 'Invalid member filters'; END IF;
 RETURN (WITH matching AS MATERIALIZED (SELECT * FROM lub.member_directory_rows(org,search,committee,term,false)),
 filtered AS MATERIALIZED (SELECT * FROM matching WHERE state='all' OR status_code=state),
 page AS MATERIALIZED (
  SELECT m.*,row_number() OVER(ORDER BY CASE WHEN ordering='name:asc' THEN m.name END ASC,CASE WHEN ordering='name:desc' THEN m.name END DESC,
    CASE WHEN ordering='date:asc' THEN m.start_date END ASC,CASE WHEN ordering='date:desc' THEN m.start_date END DESC,m.member_id) pos
  FROM filtered m ORDER BY pos LIMIT 25 OFFSET greatest(0,least(skip,250000))
 )
 SELECT jsonb_build_object('canExport',lub.has_scoped_capability(org,'REPORTS_GENERATE'),
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),
  'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),'rowTotal',(SELECT count(*) FROM filtered),
  'counts',(SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE status_code='Active'),'ended',count(*) FILTER(WHERE status_code='Ended'),'inactive',0) FROM filtered WHERE NOT is_test),
  'statusCounts',(SELECT jsonb_build_object('all',count(*),'Active',count(*) FILTER(WHERE status_code='Active'),'Ended',count(*) FILTER(WHERE status_code='Ended'),'Inactive',0) FROM matching WHERE NOT is_test),
  'terms',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,
   'startDate',t.start_date,'endDate',t.end_date) ORDER BY t.start_date DESC,t.id),'[]') FROM (SELECT * FROM lub.academic_terms ORDER BY start_date DESC,id LIMIT 30) t),
  'committees',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id),'[]') FROM lub.committees c
    WHERE c.organization_id=org AND c.status_code='Active' AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id)),
  'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.member_id,'userId',m.user_id,'name',m.name,'major',m.major,'level',m.level,
   'universityCiphertext',u.university_id_ciphertext,'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,
   'canManage',m.status_code='Active' AND lub.has_org_permission(org,'MEMBERS_MANAGE'),'hours',lub.member_approved_hours(org,m.user_id,term),
   'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',a.role_code,'committee',c.name) ORDER BY a.role_code,c.name)
    FROM lub.access_assignments a LEFT JOIN lub.committees c ON c.id=a.committee_id WHERE a.organization_membership_id=m.member_id
    AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())),'[]'),
   'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id)
    FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.member_id
    AND cm.status_code='Active' AND cm.start_date<=lub.today_riyadh() AND (cm.end_date IS NULL OR cm.end_date>lub.today_riyadh())),'[]'),
   'hourScopes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id)
    FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.member_id
    AND cm.status_code='Active' AND cm.start_date<=lub.today_riyadh() AND (cm.end_date IS NULL OR cm.end_date>lub.today_riyadh())
    AND lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id)),'[]')) ORDER BY m.pos),'[]')
    FROM page m JOIN lub.users u ON u.id=m.user_id))
 );
END; $$;

CREATE FUNCTION lub.member_profile(org uuid,target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE student uuid; scope uuid[];
BEGIN
 SELECT m.user_id INTO student FROM lub.organization_memberships m WHERE m.id=target AND m.organization_id=org AND lub.is_student_account(m.user_id);
 scope:=lub.member_committee_scope(org,'MEMBERS_VIEW');
 IF student IS NULL OR NOT(lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.member_in_committees(org,student,scope))
 THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('id',m.id,'userId',u.id,'name',u.full_name_ar,'major',u.major_name,'level',u.academic_level,
  'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,'universityCiphertext',u.university_id_ciphertext,
  'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,'avatar',null,
  'organization',jsonb_build_object('name',o.name_ar,'slug',o.slug),'hours',lub.member_approved_hours(org,student,null),
  'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',a.role_code,'committee',c.name,
   'startDate',(a.start_at AT TIME ZONE 'Asia/Riyadh')::date,'endDate',(a.end_at AT TIME ZONE 'Asia/Riyadh')::date) ORDER BY a.start_at DESC,a.id)
   FROM lub.access_assignments a LEFT JOIN lub.committees c ON c.id=a.committee_id WHERE a.organization_id=org AND a.user_id=student),'[]'),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.name,'status',cm.status_code,'startDate',cm.start_date,'endDate',cm.end_date)
    ORDER BY cm.start_date DESC,cm.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id
    JOIN lub.organization_memberships history ON history.id=cm.organization_membership_id WHERE history.organization_id=org AND history.user_id=student),'[]'),
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object('code',CASE WHEN e.event_code='MembershipStarted' THEN 'Joined' ELSE e.event_code END,
    'at',e.occurred_at,'actor',actor.full_name_ar,'imported',false) ORDER BY e.occurred_at DESC,e.id)
    FROM lub.history_events e JOIN lub.organization_memberships history ON history.id=e.organization_membership_id
    LEFT JOIN lub.users actor ON actor.id=e.actor_user_id WHERE history.organization_id=org AND history.user_id=student),'[]'))
 FROM lub.organization_memberships m JOIN lub.organizations o ON o.id=m.organization_id JOIN lub.users u ON u.id=m.user_id
 LEFT JOIN lub.private_student_identifiers n ON n.user_id=u.id WHERE m.id=target);
END; $$;

REVOKE ALL ON FUNCTION lub.member_committee_scope(uuid,text),lub.member_in_committees(uuid,uuid,uuid[]),
 lub.member_approved_hours(uuid,uuid,uuid,uuid[]),lub.member_directory_rows(uuid,text,uuid,uuid,boolean),
 lub.organization_member_directory(uuid,text,text,uuid,integer,text,uuid),lub.member_profile(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.organization_member_directory(uuid,text,text,uuid,integer,text,uuid),lub.member_profile(uuid,uuid) TO authenticated;

CREATE FUNCTION lub.lock_active_membership(target uuid,capability text) RETURNS lub.organization_memberships
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; member lub.organization_memberships;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=target;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO member FROM lub.organization_memberships WHERE id=target FOR UPDATE;
 IF member.id IS NULL OR member.status_code<>'Active' OR member.start_date>lub.today_riyadh()
  OR (member.end_date IS NOT NULL AND member.end_date<=lub.today_riyadh())
  OR NOT lub.is_student_account(member.user_id) OR NOT lub.has_org_permission(org,capability)
 THEN RAISE EXCEPTION 'Active membership permission required' USING ERRCODE='42501'; END IF;
 RETURN member;
END; $$;

CREATE FUNCTION lub.change_member_role(target uuid,new_role text,committee uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member lub.organization_memberships;
BEGIN
 member:=lub.lock_active_membership(target,'PERMISSIONS_GRANT');
 IF new_role IS NULL OR new_role NOT IN ('Member','OD','CL','CD','HRL','HRD') OR member.user_id=auth.uid()
  OR EXISTS(SELECT 1 FROM lub.access_assignments WHERE organization_membership_id=target AND role_code='OL' AND end_at IS NULL)
 THEN RAISE EXCEPTION 'Role assignment unavailable' USING ERRCODE='42501'; END IF;
 IF new_role IN ('CL','CD') THEN
  IF committee IS NULL OR NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=member.organization_id AND status_code='Active')
  THEN RAISE EXCEPTION 'Active same-organization committee required'; END IF;
 ELSIF committee IS NOT NULL THEN RAISE EXCEPTION 'Unexpected role scope'; END IF;
 IF new_role IN ('HRL','HRD') AND EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=member.organization_id
  AND c.status_code='Active' AND lub.is_hr_committee(c.id)) THEN RAISE EXCEPTION 'Use the HR committee role'; END IF;
 UPDATE lub.access_assignments SET end_at=greatest(start_at+interval '1 microsecond',clock_timestamp())
  WHERE organization_membership_id=target AND role_code<>'OL' AND (end_at IS NULL OR end_at>statement_timestamp());
 IF new_role<>'Member' THEN
  INSERT INTO lub.access_assignments(user_id,organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id)
   VALUES(member.user_id,target,member.organization_id,committee,new_role,auth.uid());
 END IF;
 IF committee IS NOT NULL THEN
  INSERT INTO lub.committee_memberships(organization_id,organization_membership_id,committee_id)
   VALUES(member.organization_id,target,committee) ON CONFLICT(organization_membership_id,committee_id)
   WHERE status_code='Active' AND end_date IS NULL DO NOTHING;
 END IF;
END; $$;

CREATE FUNCTION lub.move_member_committee(target uuid,destination uuid,confirm_role_change boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member lub.organization_memberships;
BEGIN
 member:=lub.lock_active_membership(target,'MEMBERS_MANAGE');
 IF destination IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=destination AND organization_id=member.organization_id AND status_code='Active')
 THEN RAISE EXCEPTION 'Active same-organization committee required'; END IF;
 IF confirm_role_change IS DISTINCT FROM true AND EXISTS(SELECT 1 FROM lub.access_assignments
  WHERE organization_membership_id=target AND committee_id IS NOT NULL AND committee_id IS DISTINCT FROM destination AND end_at IS NULL)
 THEN RAISE EXCEPTION 'Committee leadership change confirmation required'; END IF;
 UPDATE lub.access_assignments SET end_at=greatest(start_at+interval '1 microsecond',clock_timestamp())
  WHERE organization_membership_id=target AND committee_id IS NOT NULL AND committee_id IS DISTINCT FROM destination AND end_at IS NULL;
 UPDATE lub.committee_memberships SET status_code='Ended',end_date=greatest(start_date,lub.today_riyadh())
  WHERE organization_membership_id=target AND committee_id IS DISTINCT FROM destination AND status_code='Active' AND end_date IS NULL;
 IF destination IS NOT NULL THEN
  INSERT INTO lub.committee_memberships(organization_id,organization_membership_id,committee_id)
   VALUES(member.organization_id,target,destination) ON CONFLICT(organization_membership_id,committee_id)
   WHERE status_code='Active' AND end_date IS NULL DO NOTHING;
 END IF;
END; $$;

CREATE FUNCTION lub.end_organization_membership(target uuid,reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member lub.organization_memberships;
BEGIN
 member:=lub.lock_active_membership(target,'MEMBERS_MANAGE');
 IF reason IS NULL OR length(trim(reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Membership end reason required'; END IF;
 IF EXISTS(SELECT 1 FROM lub.access_assignments WHERE organization_id=member.organization_id AND user_id=member.user_id AND role_code='OL' AND end_at IS NULL)
 THEN RAISE EXCEPTION 'Use primary leader appointment to end the active primary leader'; END IF;
 UPDATE lub.organization_memberships SET status_code='Ended',end_date=lub.today_riyadh(),ended_reason=trim(reason),updated_at=now() WHERE id=target;
 UPDATE lub.committee_memberships SET status_code='Ended',end_date=greatest(start_date,lub.today_riyadh())
  WHERE organization_membership_id=target AND status_code='Active' AND end_date IS NULL;
 UPDATE lub.access_assignments SET end_at=greatest(start_at+interval '1 microsecond',clock_timestamp())
  WHERE organization_membership_id=target AND (end_at IS NULL OR end_at>statement_timestamp());
 INSERT INTO lub.history_events(organization_id,organization_membership_id,event_code,from_status_code,to_status_code,reason,actor_user_id)
  VALUES(member.organization_id,target,'Ended','Active','Ended',trim(reason),auth.uid());
END; $$;

REVOKE ALL ON FUNCTION lub.lock_active_membership(uuid,text),lub.change_member_role(uuid,text,uuid),
 lub.move_member_committee(uuid,uuid,boolean),lub.end_organization_membership(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.change_member_role(uuid,text,uuid),lub.move_member_committee(uuid,uuid,boolean),
 lub.end_organization_membership(uuid,text) TO authenticated;

CREATE FUNCTION lub.application_member_profile(org uuid,target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('id',a.id,'userId',u.id,'name',u.full_name_ar,'major',u.major_name,'level',u.academic_level,
  'status',a.status_code,'startDate',(a.submitted_at AT TIME ZONE 'Asia/Riyadh')::date,'endDate',null,
  'universityCiphertext',u.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,
  'avatar',null,'hours',0,'organization',jsonb_build_object('name',o.name_ar,'slug',o.slug),
  'roles','[]'::jsonb,'committees','[]'::jsonb,'events','[]'::jsonb)
 INTO result FROM lub.membership_cases a JOIN lub.organizations o ON o.id=a.organization_id JOIN lub.users u ON u.id=a.user_id
 LEFT JOIN lub.private_student_identifiers n ON n.user_id=u.id WHERE a.id=target AND a.organization_id=org AND a.kind='Registration'
 AND lub.is_student_account(u.id) AND lub.has_org_permission(org,'APPLICATIONS_VIEW',a.requested_committee_id);
 IF result IS NULL THEN RAISE EXCEPTION 'Application permission required' USING ERRCODE='42501'; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.application_member_profile(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.application_member_profile(uuid,uuid) TO authenticated;
