CREATE FUNCTION lub.restore_markdown_organization(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE operator_id uuid;org lub.organizations;committee lub.committees;ev lub.events;item jsonb;k text;candidate text;previous text;parent_id uuid;changed jsonb:='[]';kept jsonb:='[]';profile jsonb;identifier uuid;
BEGIN
 IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='lub.organizations'::regclass)) OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Database maintenance owner required' USING ERRCODE='42501';END IF;
 SELECT u.id INTO operator_id FROM lub.users u JOIN lub.global_role_assignments r ON r.user_id=u.id WHERE u.status_code='Active' AND u.email_verified_at IS NOT NULL AND r.role_code='SA' AND r.start_at<=now() AND (r.end_at IS NULL OR r.end_at>now()) ORDER BY u.id LIMIT 1;
 IF operator_id IS NULL THEN RAISE EXCEPTION 'Verified operator required';END IF;
 IF jsonb_typeof(payload)<>'object' OR octet_length(payload::text)>500000 THEN RAISE EXCEPTION 'Invalid source';END IF;
 SELECT * INTO org FROM lub.organizations WHERE slug=payload->>'slug' FOR UPDATE;
 IF org.id IS NULL THEN RAISE EXCEPTION 'Unknown organization';END IF;
 FOR k IN SELECT unnest(ARRAY['name','type','summary','mission']) LOOP
  candidate:=coalesce(payload->>k,'');IF candidate='' THEN CONTINUE;END IF;
  previous:=CASE k WHEN 'name' THEN org.name_ar WHEN 'type' THEN org.type_code WHEN 'summary' THEN org.summary ELSE org.mission END;
  IF coalesce(btrim(previous),'')='' THEN
   IF (k='summary' AND length(candidate)>1000) OR (k='mission' AND length(candidate)>3000) THEN RAISE EXCEPTION 'Source exceeds field limit';END IF;
   IF k='name' THEN UPDATE lub.organizations SET name_ar=candidate WHERE id=org.id;ELSIF k='type' THEN UPDATE lub.organizations SET type_code=candidate WHERE id=org.id;ELSIF k='summary' THEN UPDATE lub.organizations SET summary=candidate WHERE id=org.id;ELSE UPDATE lub.organizations SET mission=candidate WHERE id=org.id;END IF;changed:=changed||jsonb_build_array(k);
  ELSE kept:=kept||jsonb_build_array(jsonb_build_object('field',k,'current',previous,'source',candidate,'different',previous<>candidate));END IF;
 END LOOP;
 profile:=coalesce(org.public_profile_content,'{}');
 FOR k,candidate IN SELECT key,value FROM jsonb_each_text(coalesce(payload->'profile','{}')) LOOP
  IF k NOT IN('vision','values','annualEventCount','participatingStudentCount','offerings','goals','fields','programs','achievements','partners','partnersImageUrl') OR length(candidate)>10000 THEN RAISE EXCEPTION 'Invalid profile field';END IF;IF btrim(candidate)='' THEN CONTINUE;END IF;
  previous:=profile->>k;
  IF coalesce(btrim(previous),'')='' THEN profile:=jsonb_set(profile,ARRAY[k],to_jsonb(candidate));changed:=changed||jsonb_build_array('profile.'||k);
  ELSE kept:=kept||jsonb_build_array(jsonb_build_object('field','profile.'||k,'current',previous,'source',candidate,'different',previous<>candidate));END IF;
 END LOOP;
 IF profile IS DISTINCT FROM coalesce(org.public_profile_content,'{}') THEN UPDATE lub.organizations SET public_profile_content=profile,updated_at=now() WHERE id=org.id;END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(coalesce(payload->'contacts','[]')) LOOP
  k:=item->>'kind';candidate:=item->>'url';IF k NOT IN('Website','Email','Phone','LinkedIn','GitHub','Instagram','X','YouTube','TikTok','WhatsApp','Telegram','Behance') OR candidate IS NULL THEN RAISE EXCEPTION 'Invalid contact';END IF;
  SELECT url INTO previous FROM lub.organization_links WHERE organization_id=org.id AND link_type=k AND btrim(url)<>'' ORDER BY sort_order,id LIMIT 1;
  IF previous IS NULL THEN INSERT INTO lub.organization_links(organization_id,link_type,url,sort_order) VALUES(org.id,k,candidate,(SELECT coalesce(max(sort_order),-1)+1 FROM lub.organization_links WHERE organization_id=org.id));changed:=changed||jsonb_build_array('contact.'||k);
  ELSE kept:=kept||jsonb_build_array(jsonb_build_object('field','contact.'||k,'current',previous,'source',candidate,'different',previous<>candidate));END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(coalesce(payload->'committees','[]')) LOOP
  candidate:=item->>'name';IF length(candidate) NOT BETWEEN 2 AND 120 OR length(coalesce(item->>'description',''))>2000 THEN RAISE EXCEPTION 'Invalid committee source';END IF;
  parent_id:=NULL;
  IF nullif(item->>'parent','') IS NOT NULL THEN SELECT c.id INTO parent_id FROM lub.committees c WHERE c.organization_id=org.id AND c.status_code='Active' AND lub.arabic_search_key(regexp_replace(trim(c.name),'^لجنة\s+',''))=lub.arabic_search_key(regexp_replace(trim(item->>'parent'),'^لجنة\s+','')) AND c.parent_committee_id IS NULL ORDER BY c.id LIMIT 1;IF parent_id IS NULL THEN RAISE EXCEPTION 'Source parent is missing';END IF;END IF;
  SELECT * INTO committee FROM lub.committees c WHERE c.organization_id=org.id AND c.status_code='Active' AND lub.arabic_search_key(regexp_replace(trim(c.name),'^لجنة\s+',''))=lub.arabic_search_key(regexp_replace(trim(candidate),'^لجنة\s+','')) ORDER BY c.id LIMIT 1;
  IF committee.id IS NULL THEN INSERT INTO lub.committees(organization_id,name,description,parent_committee_id,is_public) VALUES(org.id,candidate,coalesce(item->>'description',''),parent_id,true) RETURNING id INTO identifier;changed:=changed||jsonb_build_array('committee.'||candidate);
  ELSE
   IF btrim(committee.description)='' AND btrim(coalesce(item->>'description',''))<>'' THEN UPDATE lub.committees SET description=item->>'description',updated_at=now() WHERE id=committee.id;changed:=changed||jsonb_build_array('committee.'||committee.name||'.description');ELSE kept:=kept||jsonb_build_array(jsonb_build_object('field','committee.'||committee.name||'.description','current',committee.description,'source',item->>'description','different',committee.description<>coalesce(item->>'description','')));END IF;
   IF committee.parent_committee_id IS DISTINCT FROM parent_id THEN kept:=kept||jsonb_build_array(jsonb_build_object('field','committee.'||committee.name||'.parent','current',committee.parent_committee_id,'source',parent_id,'different',true));END IF;
  END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(coalesce(payload->'events','[]')) LOOP
  candidate:=item->>'title';identifier:=(item->>'id')::uuid;IF length(candidate) NOT BETWEEN 2 AND 120 OR length(coalesce(item->>'description',''))>6000 OR length(coalesce(item->>'dateText',''))>1000 THEN RAISE EXCEPTION 'Invalid event source';END IF;
  SELECT * INTO ev FROM lub.events WHERE organization_id=org.id AND (id=identifier OR (lub.arabic_search_key(title)=lub.arabic_search_key(candidate) AND (status_code<>'Archived' OR source_date_text IS NOT DISTINCT FROM nullif(item->>'dateText','')))) ORDER BY id LIMIT 1;
  IF ev.id IS NULL THEN INSERT INTO lub.events(id,organization_id,created_by_user_id,title,description,location_type_code,status_code,published_at,source_date_text) VALUES(identifier,org.id,operator_id,candidate,coalesce(item->>'description',''),'Unknown','Archived',now(),nullif(item->>'dateText',''));changed:=changed||jsonb_build_array('event.'||candidate);
  ELSE
   IF btrim(ev.description)='' AND btrim(coalesce(item->>'description',''))<>'' THEN UPDATE lub.events SET description=item->>'description',updated_at=now() WHERE id=ev.id;changed:=changed||jsonb_build_array('event.'||candidate||'.description');ELSE kept:=kept||jsonb_build_array(jsonb_build_object('field','event.'||candidate||'.description','current',ev.description,'source',item->>'description','different',ev.description<>coalesce(item->>'description','')));END IF;
   IF ev.status_code='Archived' AND coalesce(btrim(ev.source_date_text),'')='' AND btrim(coalesce(item->>'dateText',''))<>'' THEN UPDATE lub.events SET source_date_text=item->>'dateText',updated_at=now() WHERE id=ev.id;changed:=changed||jsonb_build_array('event.'||candidate||'.date');END IF;
  END IF;
 END LOOP;
 IF jsonb_array_length(changed)>0 THEN INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(operator_id,'MARKDOWN_CONTENT_RESTORED','Organization',org.id,org.id,'{}');END IF;
 RETURN jsonb_build_object('slug',org.slug,'changed',changed,'kept',kept);
END; $$;
REVOKE ALL ON FUNCTION lub.restore_markdown_organization(jsonb) FROM PUBLIC,anon,authenticated;
