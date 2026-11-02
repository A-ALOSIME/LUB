create function lub.member_scope_allows(org uuid,target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from lub.organization_memberships m where m.id=target and m.organization_id=org and (
 lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or exists(
  select 1 from lub.committees c where c.organization_id=org and lub.has_org_permission(org,'MEMBERS_VIEW',c.id) and (
   exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id)
   or exists(select 1 from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and r.committee_id=c.id)
  )
 )));
$$;
revoke all on function lub.member_scope_allows(uuid,uuid) from public,anon;
grant execute on function lub.member_scope_allows(uuid,uuid) to authenticated;
--> statement-breakpoint
create function lub.organization_member_directory(org uuid,query text,status text,committee uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not lub.has_org_permission(org,'MEMBERS_VIEW') and not lub.has_org_permission(org,'MEMBERS_MANAGE') and not exists(select 1 from lub.committees c where c.organization_id=org and lub.has_org_permission(org,'MEMBERS_VIEW',c.id)) then raise exception 'Permission required' using errcode='42501';end if;
 if status not in ('all','Active','Ended','Inactive') or char_length(coalesce(query,''))>120 then raise exception 'Invalid member filters';end if;
 if committee is not null and (not exists(select 1 from lub.committees c where c.id=committee and c.organization_id=org) or not (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',committee))) then raise exception 'Committee permission required' using errcode='42501';end if;
 with visible as(
  select m.*,p.full_name_ar,p.major_name,p.academic_level,p.university_id_ciphertext
  from lub.organization_memberships m join lub.student_profiles p on p.user_id=m.user_id join lub.users u on u.id=m.user_id
  where m.organization_id=org and m.merged_into is null and u.status_code='Active' and lub.is_student_account(m.user_id) and lub.member_scope_allows(org,m.id)
 ),matches as(
  select m.* from visible m where
  (coalesce(trim(query),'')='' or position(lub.arabic_search_key(query) in lub.arabic_search_key(m.full_name_ar||' '||m.major_name))>0 or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id join lub.committees c on c.id=cm.committee_id where history.user_id=m.user_id and history.organization_id=org and position(lub.arabic_search_key(query) in lub.arabic_search_key(c.name))>0))
  and (committee is null or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=committee))
 ),filtered as(select * from matches where status='all' or status_code=status)
 select jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'counts',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status_code='Active'),'ended',count(*) filter(where status_code='Ended'),'inactive',count(*) filter(where status_code='Inactive')) from filtered),
  'statusCounts',(select jsonb_build_object('all',count(*),'Active',count(*) filter(where status_code='Active'),'Ended',count(*) filter(where status_code='Ended'),'Inactive',count(*) filter(where status_code='Inactive')) from matches),
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
revoke all on function lub.organization_member_directory(uuid,text,text,uuid) from public,anon;
grant execute on function lub.organization_member_directory(uuid,text,text,uuid) to authenticated;
create or replace function lub.organization_member_directory(org uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_set(workspace,'{members}',coalesce((select jsonb_agg(value-'userId'-'universityCiphertext') from jsonb_array_elements(workspace->'members')),'[]'::jsonb)) from(select lub.organization_member_directory(org,'','all',null) workspace) directory$$;
--> statement-breakpoint
create function lub.member_record_payload(org uuid,target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;canonical uuid;
begin
 if not lub.member_scope_allows(org,target) then raise exception 'Member permission required' using errcode='42501';end if;
 select coalesce(m.merged_into,m.id) into canonical from lub.organization_memberships m where m.id=target and m.organization_id=org;
 select jsonb_build_object('id',m.id,'userId',m.user_id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,
  'universityCiphertext',p.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,'organization',jsonb_build_object('name',o.name_ar,'slug',o.slug),
  'avatar',case when lub.public_talent_eligible(m.user_id) and lub.public_avatar_version(m.user_id) is not null then '/talent/'||ps.public_slug::text||'/avatar?v='||lub.public_avatar_version(m.user_id) end,
  'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and h.status_code='Approved'),0),
  'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name,'startDate',r.start_date,'endDate',r.end_date) order by r.start_date desc,r.id) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id left join lub.committees c on c.id=r.committee_id where history.user_id=m.user_id and history.organization_id=org),'[]'::jsonb),
  'committees',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'status',cm.status_code,'startDate',cm.start_date,'endDate',cm.end_date) order by cm.start_date desc,cm.id) from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id join lub.committees c on c.id=cm.committee_id where history.user_id=m.user_id and history.organization_id=org),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('code',e.event_code,'at',e.occurred_at,'actor',actor.full_name_ar,'imported',e.imported) order by e.occurred_at desc,e.id desc) from lub.membership_events e left join lub.student_profiles actor on actor.user_id=e.actor_user_id where e.membership_id=m.id),'[]'::jsonb)
 ) into result from lub.organization_memberships m join lub.student_profiles p on p.user_id=m.user_id join lub.users u on u.id=m.user_id join lub.organizations o on o.id=m.organization_id left join lub.private_student_identifiers n on n.user_id=m.user_id left join lub.profile_settings ps on ps.user_id=m.user_id where m.id=canonical and m.organization_id=org;
 return result;
end;$$;
revoke all on function lub.member_record_payload(uuid,uuid) from public,anon,authenticated;
create function lub.member_profile(org uuid,target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=lub.member_record_payload(org,target);
 insert into lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) values(auth.uid(),'MEMBER_DETAILS_VIEWED','organization_membership',(result->>'id')::uuid,org,'{"sensitive_fields":true}'::jsonb);
 return result;
end;$$;
revoke all on function lub.member_profile(uuid,uuid) from public,anon;
grant execute on function lub.member_profile(uuid,uuid) to authenticated;
