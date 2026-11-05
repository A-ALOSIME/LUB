create or replace function lub.organization_member_directory(org uuid,query text,status text,committee uuid,skip integer,ordering text,term uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wide boolean; allowed_committees uuid[];
begin
 if term is not null and not exists(select 1 from lub.academic_terms where id=term) then raise exception 'Invalid term';end if;
 if ordering is null or ordering not in ('name:asc','name:desc','date:asc','date:desc') then raise exception 'Invalid ordering';end if;
 wide:=lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE');
 select array_agg(c.id) into allowed_committees from lub.committees c where c.organization_id=org and lub.has_org_permission(org,'MEMBERS_VIEW',c.id);
 if not wide and coalesce(cardinality(allowed_committees),0)=0 then raise exception 'Permission required' using errcode='42501';end if;
 if status not in ('all','Active','Ended','Inactive') or char_length(coalesce(query,''))>120 then raise exception 'Invalid member filters';end if;
 if committee is not null and (not exists(select 1 from lub.committees c where c.id=committee and c.organization_id=org) or not (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',committee))) then raise exception 'Committee permission required' using errcode='42501';end if;
 with visible as(
  select m.*,u.is_test,p.full_name_ar,p.major_name,p.academic_level,p.university_id_ciphertext
  from lub.organization_memberships m join lub.student_profiles p on p.user_id=m.user_id join lub.users u on u.id=m.user_id
  where (term is null or exists(
 select 1 from lub.academic_terms t where t.id=term and (
 exists(select 1 from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined')
 and e.occurred_at<((t.end_date+1)::timestamp AT TIME ZONE 'Asia/Riyadh')
 and coalesce((select min(ended.occurred_at) from lub.membership_events ended where ended.membership_id=m.id and ended.occurred_at>e.occurred_at and ended.event_code='Ended'),'infinity'::timestamptz)>(t.start_date::timestamp AT TIME ZONE 'Asia/Riyadh'))
 or (not exists(select 1 from lub.membership_events e where e.membership_id=m.id) and m.start_date<=t.end_date and coalesce(m.end_date,'infinity'::date)>t.start_date))))
 and m.organization_id=org and m.merged_into is null and u.status_code='Active' and lub.is_student_account(m.user_id) and (wide or exists(select 1 from lub.organization_memberships history left join lub.committee_memberships cm on cm.organization_membership_id=history.id left join lub.role_assignments r on r.organization_membership_id=history.id where history.organization_id=org and history.user_id=m.user_id and (cm.committee_id=any(allowed_committees) or r.committee_id=any(allowed_committees))))
 ),matches as(
  select m.* from visible m where
  (coalesce(trim(query),'')='' or position(lub.arabic_search_key(query) in lub.arabic_search_key(m.full_name_ar||' '||m.major_name))>0 or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id join lub.committees c on c.id=cm.committee_id where history.user_id=m.user_id and history.organization_id=org and position(lub.arabic_search_key(query) in lub.arabic_search_key(c.name))>0))
  and (committee is null or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=committee))
 ),filtered as(select * from matches where status='all' or status_code=status)
 select jsonb_build_object(
  'canExport',lub.has_org_permission(org,'REPORTS_GENERATE') OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'REPORTS_GENERATE',c.id)),
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
   'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and h.status_code='Approved' and (term is null or h.academic_term_id=term)),0),
   'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) order by r.role_code,c.name) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id left join lub.committees c on c.id=r.committee_id where history.user_id=m.user_id and history.organization_id=org and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
   'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb),
   'hourScopes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id) and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb)
   ) row_data,row_number() over(order by case when ordering='name:asc' then m.full_name_ar end asc,case when ordering='name:desc' then m.full_name_ar end desc,case when ordering='date:asc' then m.start_date end asc,case when ordering='date:desc' then m.start_date end desc,m.id) as row_order from filtered m order by case when ordering='name:asc' then m.full_name_ar end asc,case when ordering='name:desc' then m.full_name_ar end desc,case when ordering='date:asc' then m.start_date end asc,case when ordering='date:desc' then m.start_date end desc,m.id limit 25 offset greatest(0,least(skip,250000))
  ) rows),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
REVOKE ALL ON FUNCTION lub.organization_member_directory(uuid,text,text,uuid,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.organization_member_directory(uuid,text,text,uuid,integer,text,uuid) TO authenticated;
--> statement-breakpoint
ALTER TABLE lub.member_exports ADD COLUMN academic_term_id uuid REFERENCES lub.academic_terms(id);
create function public.prepare_member_export(org uuid,q text,state text,committee uuid,term uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare directory jsonb;ticket lub.member_exports;
begin
 if auth.uid() is null or q is null or length(q)>120 or state is null or state not in ('all','Active','Ended','Inactive') then raise exception 'Export unavailable' using errcode='42501';end if;
 -- This scoped directory call validates organization, committee and actual current grants.
 directory:=lub.organization_member_directory(org,q,state,committee,0,'name:asc',term);
 if (directory->>'rowTotal')::int>500 then raise exception 'Refine filters before exporting' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('member-export:'||auth.uid()::text,0));
 if (select count(*) from lub.member_exports where owner_user_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=6 then raise exception 'Export rate limit' using errcode='54000';end if;
 insert into lub.member_exports(owner_user_id,organization_id,query,status,committee_id,academic_term_id) values(auth.uid(),org,trim(q),state,committee,term) returning * into ticket;
 return jsonb_build_object('ticket',ticket.id,'expires_at',ticket.expires_at);
end;$$;

REVOKE ALL ON FUNCTION public.prepare_member_export(uuid,text,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_member_export(uuid,text,text,uuid,uuid) TO authenticated;
--> statement-breakpoint
create or replace function public.consume_member_export(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket lub.member_exports;directory jsonb;records jsonb;slug text;page_data jsonb;all_members jsonb:='[]'::jsonb;page_offset integer:=0;
begin
 select * into ticket from lub.member_exports where id=target and owner_user_id=auth.uid() for update;
 if ticket.id is null or ticket.used_at is not null or ticket.expires_at<=clock_timestamp() then raise exception 'Export expired or unavailable' using errcode='42501';end if;
 loop
  page_data:=lub.organization_member_directory(ticket.organization_id,ticket.query,ticket.status,ticket.committee_id,page_offset,'name:asc',ticket.academic_term_id);
  if (page_data->>'rowTotal')::int>500 then raise exception 'Refine filters before exporting' using errcode='22023';end if;
  all_members:=all_members||(page_data->'members');
  exit when jsonb_array_length(page_data->'members')<25;
  page_offset:=page_offset+25;
 end loop;
 directory:=jsonb_build_object('members',all_members);
 select coalesce(jsonb_agg(
 jsonb_build_object('isTest',u.is_test,'userId',m.user_id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'universityCiphertext',p.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,
 'startDate',coalesce((select min(e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined')),(select min(history.start_date) from lub.organization_memberships history where history.user_id=m.user_id and history.organization_id=m.organization_id)),
 'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and h.status_code='Approved' and (ticket.academic_term_id is null or h.academic_term_id=ticket.academic_term_id)),0),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code)) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
 'committees',coalesce((select jsonb_agg(jsonb_build_object('name',c.name) order by c.name) from lub.committees c where c.organization_id=m.organization_id and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and cm.committee_id=c.id)),'[]'::jsonb)
 ) order by p.full_name_ar,m.id),'[]'::jsonb) into records
 from jsonb_array_elements(directory->'members') member join lub.organization_memberships m on m.id=(member->>'id')::uuid join lub.users u on u.id=m.user_id and not u.is_test join lub.student_profiles p on p.user_id=m.user_id left join lub.private_student_identifiers n on n.user_id=m.user_id;
 select o.slug into slug from lub.organizations o where o.id=ticket.organization_id;
 update lub.member_exports set used_at=clock_timestamp(),row_count=jsonb_array_length(records) where id=target;
 return jsonb_build_object('records',records,'slug',slug,'filter',lower(ticket.status)||case when ticket.committee_id is not null then '-committee' else '' end||case when ticket.query<>'' then '-search' else '' end||case when ticket.academic_term_id is not null then '-term' else '' end);
end;$$;
NOTIFY pgrst,'reload schema';
