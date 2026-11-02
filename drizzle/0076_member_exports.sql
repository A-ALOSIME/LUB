-- Tickets and audit metadata only. CSV bytes are generated in the Edge Function and never stored.
create table lub.member_exports(
 id uuid primary key default gen_random_uuid(),owner_user_id uuid not null references lub.users(id),organization_id uuid not null references lub.organizations(id),
 query text not null check(length(query)<=120),status text not null check(status in ('all','Active','Ended','Inactive')),committee_id uuid references lub.committees(id),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',used_at timestamptz,row_count int,
 check(row_count is null or row_count between 0 and 500)
);
create index member_exports_owner_time_idx on lub.member_exports(owner_user_id,created_at);
create index member_exports_org_time_idx on lub.member_exports(organization_id,created_at);
alter table lub.member_exports enable row level security;
revoke all on lub.member_exports from public,anon,authenticated;
--> statement-breakpoint
create function public.prepare_member_export(org uuid,q text default '',state text default 'all',committee uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare directory jsonb;ticket lub.member_exports;
begin
 if auth.uid() is null or q is null or length(q)>120 or state is null or state not in ('all','Active','Ended','Inactive') then raise exception 'Export unavailable' using errcode='42501';end if;
 -- This scoped directory call validates organization, committee and actual current grants.
 directory:=lub.organization_member_directory(org,q,state,committee);
 if (directory->'counts'->>'total')::int>jsonb_array_length(directory->'members') then raise exception 'Refine filters before exporting' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('member-export:'||auth.uid()::text,0));
 if (select count(*) from lub.member_exports where owner_user_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=6 then raise exception 'Export rate limit' using errcode='54000';end if;
 insert into lub.member_exports(owner_user_id,organization_id,query,status,committee_id) values(auth.uid(),org,trim(q),state,committee) returning * into ticket;
 return jsonb_build_object('ticket',ticket.id,'expires_at',ticket.expires_at);
end;$$;
create function public.consume_member_export(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket lub.member_exports;directory jsonb;records jsonb;
begin
 select * into ticket from lub.member_exports where id=target and owner_user_id=auth.uid() for update;
 if ticket.id is null or ticket.used_at is not null or ticket.expires_at<=clock_timestamp() then raise exception 'Export expired or unavailable' using errcode='42501';end if;
 directory:=lub.organization_member_directory(ticket.organization_id,ticket.query,ticket.status,ticket.committee_id);
 select coalesce(jsonb_agg(lub.member_record_payload(ticket.organization_id,(member->>'id')::uuid)),'[]'::jsonb) into records from jsonb_array_elements(directory->'members') member;
 update lub.member_exports set used_at=clock_timestamp(),row_count=jsonb_array_length(records) where id=target;
 return records;
end;$$;
create function lub.member_export_audit(org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from lub.role_assignments r join lub.organization_memberships m on m.id=r.organization_membership_id where r.organization_id=org and m.user_id=auth.uid() and m.status_code='Active' and r.role_code='OL' and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)) then raise exception 'Leader required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(row order by row.at desc) from(select p.full_name_ar actor,e.created_at at,e.query,e.status,c.name committee,e.row_count count from lub.member_exports e join lub.student_profiles p on p.user_id=e.owner_user_id left join lub.committees c on c.id=e.committee_id where e.organization_id=org and e.used_at is not null order by e.created_at desc limit 100) row),'[]');
end;$$;
revoke all on function public.prepare_member_export(uuid,text,text,uuid),public.consume_member_export(uuid),lub.member_export_audit(uuid) from public,anon;
grant execute on function public.prepare_member_export(uuid,text,text,uuid),public.consume_member_export(uuid),lub.member_export_audit(uuid) to authenticated;
