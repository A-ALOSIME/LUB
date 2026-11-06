-- A user-row update serializes read receipts with notification appends.
CREATE FUNCTION lub.notification_feed(page int,unread_only boolean DEFAULT false) RETURNS TABLE(id uuid,type_code text,title text,body text,target_url text,created_at text,read_at text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF page IS NULL OR page NOT BETWEEN 0 AND 10000 OR unread_only IS NULL THEN RAISE EXCEPTION 'Invalid notification filters'; END IF;
 RETURN QUERY SELECT (n->>'id')::uuid,n->>'typeCode',n->>'title',n->>'body',n->>'targetUrl',n->>'createdAt',n->>'readAt'
 FROM lub.users u CROSS JOIN LATERAL jsonb_array_elements(u.notifications) n
 WHERE u.id=auth.uid() AND u.status_code='Active' AND (NOT unread_only OR n->>'readAt' IS NULL)
 ORDER BY (n->>'createdAt')::timestamptz DESC,(n->>'id')::uuid LIMIT 26 OFFSET page*25;
END; $$;
CREATE FUNCTION lub.notification_counts() RETURNS TABLE("all" int,unread int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT count(*)::int,count(*) FILTER(WHERE n->>'readAt' IS NULL)::int FROM lub.users u CROSS JOIN LATERAL jsonb_array_elements(u.notifications) n
 WHERE u.id=auth.uid() AND u.status_code='Active';
$$;
CREATE FUNCTION lub.notification_fingerprint() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(coalesce(jsonb_agg(jsonb_build_array(n->>'id',n->>'createdAt',n->>'readAt') ORDER BY n->>'id'),'[]')::text)
 FROM lub.users u CROSS JOIN LATERAL jsonb_array_elements(u.notifications) n WHERE u.id=auth.uid() AND u.status_code='Active';
$$;
CREATE FUNCTION lub.read_task_notification(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entries jsonb;
BEGIN
 SELECT notifications INTO entries FROM lub.users WHERE id=auth.uid() AND status_code='Active' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(entries) n WHERE n->>'id'=target::text) THEN RAISE EXCEPTION 'Own notification required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(entries) n WHERE n->>'id'=target::text AND n->>'readAt' IS NULL) THEN
  UPDATE lub.users SET notifications=(SELECT jsonb_agg(CASE WHEN n->>'id'=target::text THEN n||jsonb_build_object('readAt',clock_timestamp()) ELSE n END ORDER BY ordinal)
   FROM jsonb_array_elements(entries) WITH ORDINALITY x(n,ordinal)),updated_at=now() WHERE users.id=auth.uid();
 END IF;
END; $$;
CREATE FUNCTION lub.read_all_task_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entries jsonb;
BEGIN
 SELECT notifications INTO entries FROM lub.users WHERE id=auth.uid() AND status_code='Active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 UPDATE lub.users SET notifications=coalesce((SELECT jsonb_agg(CASE WHEN n->>'readAt' IS NULL THEN n||jsonb_build_object('readAt',clock_timestamp()) ELSE n END ORDER BY ordinal)
  FROM jsonb_array_elements(entries) WITH ORDINALITY x(n,ordinal)),'[]'),updated_at=now() WHERE users.id=auth.uid();
END; $$;
REVOKE ALL ON FUNCTION lub.notification_feed(int,boolean),lub.notification_counts(),lub.notification_fingerprint(),lub.read_task_notification(uuid),lub.read_all_task_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.notification_feed(int,boolean),lub.notification_counts(),lub.notification_fingerprint(),lub.read_task_notification(uuid),lub.read_all_task_notifications() TO authenticated;
