-- Only service-role RPCs can access the translation cache and shared quota.
create table lub.translations (
 id uuid primary key default gen_random_uuid(),
 source_hash text not null check(source_hash ~ '^[0-9a-f]{64}$'),
 source_lang text not null check(source_lang='AR'),
 target_lang text not null check(target_lang='EN'),
 source_text text not null check(char_length(source_text) between 1 and 10000),
 translated_text text not null check(char_length(translated_text) between 1 and 30000),
 created_at timestamptz not null default now(),
 constraint translations_source_target_unique unique(source_hash,target_lang)
);
alter table lub.translations enable row level security;
revoke all on lub.translations from public,anon,authenticated;
--> statement-breakpoint
-- Attempts, including failures, consume budget; a failed result never enters the cache.
create table lub.translation_requests (
 id uuid primary key default gen_random_uuid(),
 source_hash text not null,
 target_lang text not null check(target_lang='EN'),
 characters integer not null check(characters between 1 and 10000),
 created_at timestamptz not null default now(),
 lease_until timestamptz not null default(now()+interval '60 seconds'),
 completed_at timestamptz,
 success boolean,
 constraint translation_request_completion check((completed_at is null)=(success is null))
);
create index translation_requests_time_idx on lub.translation_requests(created_at);
create unique index translation_requests_pending_idx on lub.translation_requests(source_hash,target_lang) where completed_at is null;
alter table lub.translation_requests enable row level security;
revoke all on lub.translation_requests from public,anon,authenticated;
--> statement-breakpoint
create function lub.translation_source_allowed(p_source text) returns boolean
language sql stable security definer set search_path='' as $$
 select length(trim(p_source)) between 2 and 10000 and (
  exists(select 1 from lub.organizations o
   cross join lateral(values(o.name_ar),(o.summary),(o.mission)) content(value)
   where o.status_code='Active' and position(trim(p_source) in content.value)>0)
  or exists(select 1 from lub.organizations o
   cross join lateral jsonb_each_text(coalesce(o.public_profile_content,'{}'::jsonb)) content
   where o.status_code='Active'
    and content.key in ('vision','values','offerings','goals','fields','programs','achievements','partners')
    and position(trim(p_source) in content.value)>0)
  or exists(select 1 from lub.committees c join lub.organizations o on o.id=c.organization_id
   where o.status_code='Active' and c.status_code='Active' and c.is_public
    and (p_source=c.name or p_source=c.description))
  or exists(select 1 from lub.events e join lub.organizations o on o.id=e.organization_id
   where o.status_code='Active' and e.status_code in ('Published','Completed','Archived')
    and (p_source=e.title or p_source=e.description or p_source=e.location_text or p_source=e.public_report or p_source=e.source_date_text))
  or exists(select 1 from lub.events e join lub.organizations o on o.id=e.organization_id
   where o.status_code='Active' and e.status_code='Cancelled' and e.published_at is not null
    and (p_source=e.title or p_source=e.description or p_source=e.location_text or p_source=e.public_report))
  or exists(select 1 from lub.announcements a join lub.organizations o on o.id=a.organization_id
   where o.status_code='Active' and a.published_at is not null and a.archived_at is null and a.deleted_at is null
    and (p_source=a.title or position(trim(p_source) in a.body)>0))
  or exists(select 1 from lub.tags t join lub.organization_tags ot on ot.tag_id=t.id join lub.organizations o on o.id=ot.organization_id
   where o.status_code='Active' and t.is_active and p_source=t.name_ar)
 );
$$;
revoke all on function lub.translation_source_allowed(text) from public,anon,authenticated;
--> statement-breakpoint
create function public.translation_lookup(p_source text,p_hash text,p_target text) returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if p_target is distinct from 'EN' or p_hash is distinct from encode(sha256(convert_to(p_source,'UTF8')),'hex')
  or not coalesce(lub.translation_source_allowed(p_source),false) then
  raise exception 'Public content required' using errcode='42501';
 end if;
 return(select t.translated_text from lub.translations t where t.source_hash=p_hash and t.target_lang=p_target and t.source_text=p_source);
end;
$$;
revoke all on function public.translation_lookup(text,text,text) from public,anon,authenticated;
grant execute on function public.translation_lookup(text,text,text) to service_role;
--> statement-breakpoint
create function public.translation_reserve(p_source text,p_hash text,p_target text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cached text; request_id uuid; minute_requests bigint; day_characters bigint; total_characters bigint;
begin
 -- Serialize the shared budget across all Edge instances, including concurrent misses.
 perform pg_advisory_xact_lock(912713,1);
 cached:=public.translation_lookup(p_source,p_hash,p_target);
 if cached is not null then return jsonb_build_object('state','cached','translated_text',cached);end if;
 update lub.translation_requests set completed_at=now(),success=false where completed_at is null and lease_until<now();
 if exists(select 1 from lub.translation_requests where source_hash=p_hash and target_lang=p_target and completed_at is null) then
  return jsonb_build_object('state','busy');
 end if;
 select count(*) filter(where created_at>now()-interval '1 minute'),
  coalesce(sum(characters) filter(where created_at>now()-interval '1 day'),0),coalesce(sum(characters),0)
 into minute_requests,day_characters,total_characters from lub.translation_requests;
 if minute_requests>=60 or day_characters+char_length(p_source)>50000 or total_characters+char_length(p_source)>1000000 then
  return jsonb_build_object('state','limited');
 end if;
 insert into lub.translation_requests(source_hash,target_lang,characters) values(p_hash,p_target,char_length(p_source)) returning id into request_id;
 return jsonb_build_object('state','reserved','request_id',request_id);
end;
$$;
revoke all on function public.translation_reserve(text,text,text) from public,anon,authenticated;
grant execute on function public.translation_reserve(text,text,text) to service_role;
--> statement-breakpoint
create function public.translation_finish(p_request uuid,p_source text,p_hash text,p_translated text) returns void
language plpgsql security definer set search_path='' as $$
declare attempt lub.translation_requests;
begin
 select * into attempt from lub.translation_requests where id=p_request for update;
 if not found or attempt.completed_at is not null or attempt.source_hash is distinct from p_hash then
  raise exception 'Invalid translation request' using errcode='42501';
 end if;
 if p_translated is not null then
  perform public.translation_lookup(p_source,p_hash,'EN');
  if attempt.lease_until<now() or length(trim(p_translated)) not between 1 and 30000 then raise exception 'Expired or invalid translation';end if;
  insert into lub.translations(source_hash,source_lang,target_lang,source_text,translated_text)
   values(p_hash,'AR','EN',p_source,p_translated) on conflict(source_hash,target_lang) do nothing;
 end if;
 update lub.translation_requests set completed_at=now(),success=(p_translated is not null) where id=p_request;
end;
$$;
revoke all on function public.translation_finish(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.translation_finish(uuid,text,text,text) to service_role;
