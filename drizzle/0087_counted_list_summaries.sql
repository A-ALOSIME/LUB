-- Analytics exclude test accounts, while list rows and pagination retain them.
create or replace function lub.organization_member_directory(org uuid,query text,status text,committee uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not lub.has_org_permission(org,'MEMBERS_VIEW') and not lub.has_org_permission(org,'MEMBERS_MANAGE') and not exists(select 1 from lub.committees c where c.organization_id=org and lub.has_org_permission(org,'MEMBERS_VIEW',c.id)) then raise exception 'Permission required' using errcode='42501';end if;
 if status not in ('all','Active','Ended','Inactive') or char_length(coalesce(query,''))>120 then raise exception 'Invalid member filters';end if;
 if committee is not null and (not exists(select 1 from lub.committees c where c.id=committee and c.organization_id=org) or not (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',committee))) then raise exception 'Committee permission required' using errcode='42501';end if;
 with visible as(
  select m.*,u.is_test,p.full_name_ar,p.major_name,p.academic_level,p.university_id_ciphertext
  from lub.organization_memberships m join lub.student_profiles p on p.user_id=m.user_id join lub.users u on u.id=m.user_id
  where m.organization_id=org and m.merged_into is null and u.status_code='Active' and lub.is_student_account(m.user_id) and lub.member_scope_allows(org,m.id)
 ),matches as(
  select m.* from visible m where
  (coalesce(trim(query),'')='' or position(lub.arabic_search_key(query) in lub.arabic_search_key(m.full_name_ar||' '||m.major_name))>0 or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id join lub.committees c on c.id=cm.committee_id where history.user_id=m.user_id and history.organization_id=org and position(lub.arabic_search_key(query) in lub.arabic_search_key(c.name))>0))
  and (committee is null or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=committee))
 ),filtered as(select * from matches where status='all' or status_code=status)
 select jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'rowTotal',(select count(*) from filtered),
  'counts',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status_code='Active'),'ended',count(*) filter(where status_code='Ended'),'inactive',count(*) filter(where status_code='Inactive')) from filtered where not is_test),
  'statusCounts',(select jsonb_build_object('all',count(*),'Active',count(*) filter(where status_code='Active'),'Ended',count(*) filter(where status_code='Ended'),'Inactive',count(*) filter(where status_code='Inactive')) from matches where not is_test),
  'terms',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) order by t.start_date desc,t.id) from (select * from lub.academic_terms order by start_date desc,id limit 30)t),'[]'::jsonb),
  'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(row_data order by member_name,member_id) from (
   select jsonb_build_object('id',m.id,'userId',m.user_id,'universityCiphertext',m.university_id_ciphertext,'name',m.full_name_ar,'major',m.major_name,'level',m.academic_level,'status',m.status_code,
   'startDate',coalesce((select (e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined') order by e.occurred_at desc,e.id limit 1),m.start_date),'endDate',m.end_date,
   'canManage',m.status_code='Active' and lub.has_org_permission(org,'MEMBERS_MANAGE'),
   'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and h.status_code='Approved'),0),
   'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) order by r.role_code,c.name) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id left join lub.committees c on c.id=r.committee_id where history.user_id=m.user_id and history.organization_id=org and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
   'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb),
   'hourScopes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id) and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb)
   ) row_data,m.id member_id,m.full_name_ar member_name from filtered m order by m.full_name_ar,m.id limit 500
  ) rows),'[]'::jsonb)
 ) into result;
 return result;
end;$$;

create or replace function lub.organization_member_directory(org uuid,query text,status text,committee uuid,skip integer,ordering text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wide boolean; allowed_committees uuid[];
begin
 if ordering is null or ordering not in ('name:asc','name:desc','date:asc','date:desc') then raise exception 'Invalid ordering';end if;
 wide:=lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE');
 select array_agg(c.id) into allowed_committees from lub.committees c where c.organization_id=org and lub.has_org_permission(org,'MEMBERS_VIEW',c.id);
 if not wide and coalesce(cardinality(allowed_committees),0)=0 then raise exception 'Permission required' using errcode='42501';end if;
 if status not in ('all','Active','Ended','Inactive') or char_length(coalesce(query,''))>120 then raise exception 'Invalid member filters';end if;
 if committee is not null and (not exists(select 1 from lub.committees c where c.id=committee and c.organization_id=org) or not (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',committee))) then raise exception 'Committee permission required' using errcode='42501';end if;
 with visible as(
  select m.*,u.is_test,p.full_name_ar,p.major_name,p.academic_level,p.university_id_ciphertext
  from lub.organization_memberships m join lub.student_profiles p on p.user_id=m.user_id join lub.users u on u.id=m.user_id
  where m.organization_id=org and m.merged_into is null and u.status_code='Active' and lub.is_student_account(m.user_id) and (wide or exists(select 1 from lub.organization_memberships history left join lub.committee_memberships cm on cm.organization_membership_id=history.id left join lub.role_assignments r on r.organization_membership_id=history.id where history.organization_id=org and history.user_id=m.user_id and (cm.committee_id=any(allowed_committees) or r.committee_id=any(allowed_committees))))
 ),matches as(
  select m.* from visible m where
  (coalesce(trim(query),'')='' or position(lub.arabic_search_key(query) in lub.arabic_search_key(m.full_name_ar||' '||m.major_name))>0 or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id join lub.committees c on c.id=cm.committee_id where history.user_id=m.user_id and history.organization_id=org and position(lub.arabic_search_key(query) in lub.arabic_search_key(c.name))>0))
  and (committee is null or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=committee))
 ),filtered as(select * from matches where status='all' or status_code=status)
 select jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'rowTotal',(select count(*) from filtered),
  'counts',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status_code='Active'),'ended',count(*) filter(where status_code='Ended'),'inactive',count(*) filter(where status_code='Inactive')) from filtered where not is_test),
  'statusCounts',(select jsonb_build_object('all',count(*),'Active',count(*) filter(where status_code='Active'),'Ended',count(*) filter(where status_code='Ended'),'Inactive',count(*) filter(where status_code='Inactive')) from matches where not is_test),
  'terms',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) order by t.start_date desc,t.id) from (select * from lub.academic_terms order by start_date desc,id limit 30)t),'[]'::jsonb),
  'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(row_data order by row_order) from (
   select jsonb_build_object('id',m.id,'userId',m.user_id,'universityCiphertext',m.university_id_ciphertext,'name',m.full_name_ar,'major',m.major_name,'level',m.academic_level,'status',m.status_code,
   'startDate',coalesce((select (e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined') order by e.occurred_at desc,e.id limit 1),m.start_date),'endDate',m.end_date,
   'canManage',m.status_code='Active' and lub.has_org_permission(org,'MEMBERS_MANAGE'),
   'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and h.status_code='Approved'),0),
   'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) order by r.role_code,c.name) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id left join lub.committees c on c.id=r.committee_id where history.user_id=m.user_id and history.organization_id=org and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
   'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb),
   'hourScopes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id) and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb)
   ) row_data,row_number() over(order by case when ordering='name:asc' then m.full_name_ar end asc,case when ordering='name:desc' then m.full_name_ar end desc,case when ordering='date:asc' then m.start_date end asc,case when ordering='date:desc' then m.start_date end desc,m.id) as row_order from filtered m order by case when ordering='name:asc' then m.full_name_ar end asc,case when ordering='name:desc' then m.full_name_ar end desc,case when ordering='date:asc' then m.start_date end asc,case when ordering='date:desc' then m.start_date end desc,m.id limit 25 offset greatest(0,least(skip,250000))
  ) rows),'[]'::jsonb)
 ) into result;
 return result;
end;$$;

CREATE OR REPLACE FUNCTION lub.organization_member_directory(org uuid,query text,status text,committee uuid,skip integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT lub.organization_member_directory(org,query,status,committee,skip,'name:asc'); $$;
REVOKE ALL ON FUNCTION lub.organization_member_directory(uuid,text,text,uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.organization_member_directory(uuid,text,text,uuid,integer,text) TO authenticated;
CREATE OR REPLACE FUNCTION lub.round_application_count(target uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN EXISTS(SELECT 1 FROM lub.registration_rounds r WHERE r.id=target AND lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE')) THEN (SELECT count(*)::int FROM lub.membership_applications WHERE lub.is_counted_student(applicant_user_id) AND registration_round_id=target) ELSE 0 END; $$;
CREATE OR REPLACE FUNCTION lub.own_request_page(kind text,query text,state text,ordering text,skip integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.is_student_account(auth.uid()) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active' AND email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 IF kind IS NULL OR query IS NULL OR state IS NULL OR ordering IS NULL OR skip IS NULL OR kind NOT IN('applications','renewals','organizations') OR length(query)>120 OR ordering NOT IN('asc','desc') OR skip<0 OR skip>250000 OR state NOT IN('all','Submitted','Interview','Accepted','Rejected','Withdrawn','Pending','Renewed','Declined','No_Response') THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH source AS MATERIALIZED(

  select a.id,o.name_ar as name,r.title,a.status_code as status,a.created_at,
   coalesce((select h.reason from lub.application_status_history h where h.application_id=a.id and h.to_status_code='Rejected' order by h.created_at desc,h.id desc limit 1),'') as reason,
   o.slug,o.logo_url as logo,r.id as round,(a.status_code='Submitted' and r.allow_withdrawal and lub.round_is_open(r.id)) as "canWithdraw",false as "canRespond",''::text as summary,''::text as mission,'[]'::jsonb as interests,r.opens_at as opens,r.closes_at as closes
  from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.organizations o on o.id=r.organization_id where kind='applications' and a.applicant_user_id=auth.uid()
UNION ALL

  select r.id,o.name_ar as name,t.name_ar as title,case when r.response_code='Pending' and c.closes_at<=statement_timestamp() then 'No_Response' else r.response_code end as status,c.created_at,
   ''::text as reason,o.slug,o.logo_url as logo,null::uuid as round,false as "canWithdraw",
   (r.response_code='Pending' and c.status_code='Open' and c.opens_at<=statement_timestamp() and c.closes_at>statement_timestamp() and m.status_code='Active' and m.start_date<=current_date and (m.end_date is null or m.end_date>current_date) and lub.task_scope_member(c.organization_id,null)) as "canRespond",
   ''::text as summary,''::text as mission,'[]'::jsonb as interests,c.opens_at as opens,c.closes_at as closes
  from lub.membership_renewals r join lub.organization_memberships m on m.id=r.organization_membership_id join lub.renewal_campaigns c on c.id=r.renewal_campaign_id join lub.academic_terms t on t.id=c.academic_term_id join lub.organizations o on o.id=c.organization_id where kind='renewals' and m.user_id=auth.uid()
UNION ALL

  select r.id,r.name_ar as name,case when r.type_code='Club' then 'نادي' else 'مجلس' end as title,r.status_code as status,r.created_at,r.decision_note as reason,o.slug,
   case when r.logo_webp_base64 is not null then '/organization-requests/'||r.id||'/logo' end as logo,null::uuid as round,r.status_code='Pending' as "canWithdraw",false as "canRespond",r.summary,r.mission,r.interests,null::timestamptz as opens,null::timestamptz as closes
  from lub.organization_opening_requests r left join lub.organizations o on o.id=r.organization_id where kind='organizations' and r.applicant_user_id=auth.uid()
 ),searched AS(SELECT * FROM source WHERE position(lub.arabic_search_key(query) IN lub.arabic_search_key(name||' '||title))>0),filtered AS(SELECT * FROM searched WHERE state='all' OR status=state)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(row) FROM(SELECT * FROM filtered ORDER BY CASE WHEN ordering='asc' THEN created_at END ASC,CASE WHEN ordering='desc' THEN created_at END DESC,id LIMIT 26 OFFSET skip)row),'[]'::jsonb),
 'counts',coalesce((SELECT jsonb_object_agg(status,total) FROM(SELECT status,count(*)::int total FROM searched WHERE lub.is_counted_student(auth.uid()) GROUP BY status)counts),'{}'::jsonb),'total',(SELECT count(*)::int FROM filtered)) INTO result;
 RETURN result;
END; $$;
NOTIFY pgrst, 'reload schema';
