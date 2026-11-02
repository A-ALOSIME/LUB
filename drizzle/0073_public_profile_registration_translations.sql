-- Extend translation only to fields the student has actually published.
create or replace function lub.translation_source_allowed(p_source text) returns boolean
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

  or exists(select 1 from lub.student_profiles p where lub.public_talent_eligible(p.user_id) and p_source in (p.full_name_ar,p.bio))
  or exists(select 1 from lub.registration_rounds r join lub.organizations o on o.id=r.organization_id
   where o.status_code='Active' and r.status_code<>'Draft' and p_source=r.title
    and exists(select 1 from lub.form_versions v where v.form_template_id=r.form_template_id and v.status_code='Published'))
 );
$$;
--> statement-breakpoint
create or replace function public.translation_reserve(p_source text,p_hash text,p_target text) returns jsonb
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
 return jsonb_build_object('state','reserved','request_id',request_id,'source_kind',case when exists(select 1 from lub.student_profiles p where lub.public_talent_eligible(p.user_id) and p.full_name_ar=p_source) then 'person_name' else 'content' end);
end;
$$;
