-- Opening requests preserve the API while using inline interests and user notifications.
CREATE FUNCTION lub.submit_organization_request(request_name text,kind text,description text,goals text,interest_list jsonb,logo text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 PERFORM 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active' AND email_verified_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Active student account required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM lub.organization_opening_requests WHERE applicant_user_id=auth.uid() AND status_code='Pending') THEN RAISE EXCEPTION 'OPENING_REQUEST_PENDING' USING ERRCODE='P0001';END IF;
 IF request_name IS NULL OR char_length(trim(request_name)) NOT BETWEEN 2 AND 120 OR kind IS NULL OR kind NOT IN ('Club','Council') OR description IS NULL OR char_length(trim(description)) NOT BETWEEN 1 AND 1000 OR goals IS NULL OR char_length(trim(goals)) NOT BETWEEN 1 AND 3000 OR interest_list IS NULL OR jsonb_typeof(interest_list)<>'array' OR jsonb_array_length(interest_list)>20 THEN RAISE EXCEPTION 'Invalid request';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(interest_list) item WHERE jsonb_typeof(item)<>'string' OR char_length(trim(item#>>'{}')) NOT BETWEEN 1 AND 40) THEN RAISE EXCEPTION 'Invalid interests';END IF;
 IF logo IS NOT NULL AND (char_length(logo)>88000 OR logo!~'^[A-Za-z0-9+/]+={0,2}$' OR octet_length(decode(logo,'base64'))>65536 OR substring(decode(logo,'base64') from 1 for 4)<>decode('52494646','hex') OR substring(decode(logo,'base64') from 9 for 4)<>decode('57454250','hex')) THEN RAISE EXCEPTION 'Invalid logo';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lub.arabic_search_key(request_name),0));
 IF EXISTS(SELECT 1 FROM lub.organizations WHERE lub.arabic_search_key(name_ar)=lub.arabic_search_key(request_name)) THEN RAISE EXCEPTION 'ORGANIZATION_NAME_EXISTS';END IF;
 INSERT INTO lub.organization_opening_requests(applicant_user_id,name_ar,type_code,summary,mission,interests,logo_webp_base64) VALUES(auth.uid(),trim(request_name),kind,trim(description),trim(goals),interest_list,logo) RETURNING id INTO result;
 RETURN result;
END;$$;

CREATE FUNCTION lub.withdraw_organization_request(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501';END IF;
 UPDATE lub.organization_opening_requests SET status_code='Withdrawn',decided_at=now() WHERE id=target AND applicant_user_id=auth.uid() AND status_code='Pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Owned pending request required' USING ERRCODE='42501';END IF;
END;$$;

CREATE FUNCTION lub.decide_organization_request(target uuid,decision text,note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.organization_opening_requests; created uuid; email text;
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM lub.organization_opening_requests WHERE id=target FOR UPDATE;
 IF r.id IS NULL OR r.status_code<>'Pending' OR decision IS NULL OR decision NOT IN ('Accepted','Rejected') OR note IS NULL OR char_length(note)>1000 OR (decision='Rejected' AND char_length(trim(note))=0) THEN RAISE EXCEPTION 'Pending request and valid decision required';END IF;
 IF decision='Accepted' THEN
  SELECT u.email INTO email FROM lub.users u WHERE u.id=r.applicant_user_id AND u.status_code='Active' AND u.email_verified_at IS NOT NULL AND lub.is_student_account(u.id);
  IF email IS NULL THEN RAISE EXCEPTION 'Active student applicant required';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(lub.arabic_search_key(r.name_ar),0));
  IF EXISTS(SELECT 1 FROM lub.organizations WHERE lub.arabic_search_key(name_ar)=lub.arabic_search_key(r.name_ar)) THEN RAISE EXCEPTION 'ORGANIZATION_NAME_EXISTS';END IF;
  INSERT INTO lub.organizations(type_code,slug,name_ar,summary,mission,interests,logo_url)
   VALUES(r.type_code,'org-'||replace(r.id::text,'-',''),r.name_ar,r.summary,r.mission,r.interests,CASE WHEN r.logo_webp_base64 IS NOT NULL THEN 'https://lub.community/organization-requests/'||r.id||'/logo' ELSE '' END) RETURNING id INTO created;
  PERFORM lub.set_primary_leader(created,email);
 END IF;
 UPDATE lub.organization_opening_requests SET status_code=decision,decision_note=trim(note),decided_at=now(),decided_by_user_id=auth.uid(),organization_id=created WHERE id=target;
 UPDATE lub.users SET notifications=notifications||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'typeCode','ORGANIZATION_REQUEST_'||upper(decision),
  'title',CASE WHEN decision='Accepted' THEN 'تم قبول طلب فتح الجهة' ELSE 'تم رفض طلب فتح الجهة' END,
  'body',CASE WHEN decision='Accepted' THEN 'أُنشئت الجهة وأصبحت قائدها. افتح طلبك لعرض التفاصيل.' ELSE 'افتح طلبك للاطلاع على سبب الرفض.' END,
  'targetUrl','/applications?tab=organizations','createdAt',now(),'readAt',NULL)),updated_at=now() WHERE id=r.applicant_user_id;
 RETURN created;
END;$$;

CREATE FUNCTION lub.organization_request_workspace(own_only boolean,filter_status text DEFAULT NULL,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF own_only IS NULL OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') OR (NOT own_only AND NOT lub.is_super_admin()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('counts',(SELECT jsonb_build_object('Pending',count(*) FILTER(WHERE status_code='Pending'),'Accepted',count(*) FILTER(WHERE status_code='Accepted'),'Rejected',count(*) FILTER(WHERE status_code='Rejected')) FROM lub.organization_opening_requests WHERE NOT own_only OR applicant_user_id=auth.uid()),
 'items',coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC,x.id) FROM (SELECT r.id,r.name_ar,r.type_code,r.summary,r.mission,r.interests,r.status_code,r.decision_note,r.created_at,r.decided_at,r.logo_webp_base64 IS NOT NULL AS has_logo,u.full_name_ar AS applicant_name,o.slug AS organization_slug FROM lub.organization_opening_requests r LEFT JOIN lub.users u ON u.id=r.applicant_user_id LEFT JOIN lub.organizations o ON o.id=r.organization_id WHERE (NOT own_only OR r.applicant_user_id=auth.uid()) AND (filter_status IS NULL OR r.status_code=filter_status) ORDER BY r.created_at DESC,r.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) x),'[]'::jsonb));
END;$$;

CREATE FUNCTION lub.organization_request_logo(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.logo_webp_base64 FROM lub.organization_opening_requests r WHERE r.id=target AND ((r.status_code='Accepted' AND EXISTS(SELECT 1 FROM lub.organizations o WHERE o.id=r.organization_id AND o.status_code='Active' AND o.logo_url='https://lub.community/organization-requests/'||r.id||'/logo')) OR (EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (r.applicant_user_id=auth.uid() OR lub.is_super_admin())));
$$;

REVOKE ALL ON FUNCTION lub.submit_organization_request(text,text,text,text,jsonb,text),lub.withdraw_organization_request(uuid),lub.decide_organization_request(uuid,text,text),lub.organization_request_workspace(boolean,text,int),lub.organization_request_logo(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.submit_organization_request(text,text,text,text,jsonb,text),lub.withdraw_organization_request(uuid),lub.decide_organization_request(uuid,text,text),lub.organization_request_workspace(boolean,text,int),lub.organization_request_logo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.organization_request_logo(uuid) TO anon;
