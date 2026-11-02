-- Read paths stay scoped to a verified caller; detail authorization is evaluated once,
-- before reading the response/history as the function owner. No global RLS relaxation.
create function lub.application_detail(target uuid,own_only boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare app lub.membership_applications;round_row lub.registration_rounds;review boolean;staff boolean;result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lub.users where id=auth.uid() and status_code='Active') then return null;end if;
 select * into app from lub.membership_applications where id=target;
 if app.id is null or not lub.is_student_account(app.applicant_user_id) or (own_only and app.applicant_user_id<>auth.uid()) then return null;end if;
 select * into round_row from lub.registration_rounds where id=app.registration_round_id;
 review:=lub.has_org_permission(round_row.organization_id,'APPLICATIONS_REVIEW') or lub.has_org_permission(round_row.organization_id,'APPLICATIONS_REVIEW',app.requested_committee_id);
 staff:=review or lub.has_org_permission(round_row.organization_id,'APPLICATIONS_VIEW') or lub.has_org_permission(round_row.organization_id,'APPLICATIONS_VIEW',app.requested_committee_id) or lub.has_org_permission(round_row.organization_id,'APPLICATIONS_BULK_ACTION') or lub.has_org_permission(round_row.organization_id,'APPLICATIONS_BULK_ACTION',app.requested_committee_id);
 if not staff and app.applicant_user_id<>auth.uid() then return null;end if;
 select jsonb_build_object('id',app.id,'organization_id',round_row.organization_id,'campaign_title',round_row.title,'created_at',app.created_at,'status_code',app.status_code,'requested_committee_id',app.requested_committee_id,'answers',f.answers,'response_revision',f.revision,'version',to_jsonb(v),'committee_labels',lub.application_committee_labels(app.id),
 'canReview',review and not own_only,'canStaff',staff and not own_only,
 'messages',coalesce((select jsonb_agg(jsonb_build_object('body',m.body,'created_at',m.created_at) order by m.created_at,m.id) from lub.application_messages m where m.application_id=app.id),'[]'::jsonb),
 'notes',case when review and not own_only then coalesce((select jsonb_agg(jsonb_build_object('body',n.body,'created_at',n.created_at) order by n.created_at,n.id) from lub.application_internal_notes n where n.application_id=app.id),'[]'::jsonb) else '[]'::jsonb end,
 'history',coalesce((select jsonb_agg(jsonb_build_object('to_status_code',h.to_status_code,'created_at',h.created_at,'reason',h.reason) order by h.created_at,h.id) from lub.application_status_history h where h.application_id=app.id),'[]'::jsonb)) into result
 from lub.form_responses f join lub.form_versions v on v.id=f.form_version_id where f.id=app.form_response_id;
 return result;
end;$$;
revoke all on function lub.application_detail(uuid,boolean) from public,anon;
grant execute on function lub.application_detail(uuid,boolean) to authenticated;
--> statement-breakpoint
-- Applications are linked to organizations through rounds; events through memberships.
-- Index both sides of those joins instead of duplicating organization/user identifiers.
create index if not exists member_org_user_read_idx on lub.organization_memberships(organization_id,user_id);
create index if not exists member_user_org_read_idx on lub.organization_memberships(user_id,organization_id);
create index if not exists registration_round_org_read_idx on lub.registration_rounds(organization_id,id);
create index if not exists application_round_user_read_idx on lub.membership_applications(registration_round_id,applicant_user_id);
create index if not exists membership_events_actor_read_idx on lub.membership_events(actor_user_id) where actor_user_id is not null;
--> statement-breakpoint
create or replace function public.consume_member_export(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket lub.member_exports;directory jsonb;records jsonb;slug text;
begin
 select * into ticket from lub.member_exports where id=target and owner_user_id=auth.uid() for update;
 if ticket.id is null or ticket.used_at is not null or ticket.expires_at<=clock_timestamp() then raise exception 'Export expired or unavailable' using errcode='42501';end if;
 directory:=lub.organization_member_directory(ticket.organization_id,ticket.query,ticket.status,ticket.committee_id);
 if (directory->'counts'->>'total')::int>jsonb_array_length(directory->'members') then raise exception 'Refine filters before exporting' using errcode='22023';end if;
 select coalesce(jsonb_agg(
 jsonb_build_object('userId',m.user_id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'universityCiphertext',p.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,
 'startDate',coalesce((select min(e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined')),(select min(history.start_date) from lub.organization_memberships history where history.user_id=m.user_id and history.organization_id=m.organization_id)),
 'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and h.status_code='Approved'),0),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code)) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
 'committees',coalesce((select jsonb_agg(jsonb_build_object('name',c.name) order by c.name) from lub.committees c where c.organization_id=m.organization_id and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and cm.committee_id=c.id)),'[]'::jsonb)
 ) order by p.full_name_ar,m.id),'[]'::jsonb) into records
 from jsonb_array_elements(directory->'members') member join lub.organization_memberships m on m.id=(member->>'id')::uuid join lub.users u on u.id=m.user_id and not u.is_test_account join lub.student_profiles p on p.user_id=m.user_id left join lub.private_student_identifiers n on n.user_id=m.user_id;
 select o.slug into slug from lub.organizations o where o.id=ticket.organization_id;
 update lub.member_exports set used_at=clock_timestamp(),row_count=jsonb_array_length(records) where id=target;
 return jsonb_build_object('records',records,'slug',slug,'filter',lower(ticket.status)||case when ticket.committee_id is not null then '-committee' else '' end||case when ticket.query<>'' then '-search' else '' end);
end;$$;
