UPDATE lub.profile_settings SET allow_indexing=false WHERE NOT public_profile_enabled AND allow_indexing;
ALTER TABLE lub.profile_settings ADD CONSTRAINT profile_indexing_requires_public CHECK(NOT allow_indexing OR public_profile_enabled);
CREATE OR REPLACE FUNCTION lub.save_talent_settings(bio text,enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();
BEGIN
 UPDATE lub.student_profiles SET bio=trim(save_talent_settings.bio),updated_at=now() WHERE user_id=owner;
 INSERT INTO lub.profile_settings(user_id,public_profile_enabled) VALUES(owner,enabled) ON CONFLICT(user_id) DO UPDATE SET public_profile_enabled=excluded.public_profile_enabled,allow_indexing=excluded.public_profile_enabled AND lub.profile_settings.allow_indexing,updated_at=now();
 PERFORM lub.task_audit(owner,NULL,'TALENT_SETTINGS_UPDATED');
END; $$;
CREATE OR REPLACE FUNCTION lub.save_talent_settings(bio text,enabled boolean,indexable boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM lub.save_talent_settings(bio,enabled);UPDATE lub.profile_settings SET allow_indexing=enabled AND indexable WHERE user_id=auth.uid();END; $$;
CREATE FUNCTION lub.save_talent_bio(bio text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();
BEGIN
 IF bio IS NULL OR length(bio)>1000 THEN RAISE EXCEPTION 'Invalid bio';END IF;
 UPDATE lub.student_profiles SET bio=trim(save_talent_bio.bio),updated_at=now() WHERE user_id=owner;
 PERFORM lub.task_audit(owner,NULL,'TALENT_BIO_UPDATED');
END; $$;
CREATE FUNCTION lub.save_talent_privacy(enabled boolean,indexable boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();result jsonb;
BEGIN
 IF enabled IS NULL OR indexable IS NULL THEN RAISE EXCEPTION 'Invalid privacy state';END IF;
 INSERT INTO lub.profile_settings(user_id,public_profile_enabled,allow_indexing) VALUES(owner,enabled,enabled AND indexable) ON CONFLICT(user_id) DO UPDATE SET public_profile_enabled=excluded.public_profile_enabled,allow_indexing=excluded.allow_indexing,updated_at=now();
 SELECT jsonb_build_object('enabled',public_profile_enabled,'indexable',allow_indexing,'slug',public_slug) INTO result FROM lub.profile_settings WHERE user_id=owner;
 PERFORM lub.task_audit(owner,NULL,'TALENT_PRIVACY_UPDATED');RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.save_talent_bio(text),lub.save_talent_privacy(boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.save_talent_bio(text),lub.save_talent_privacy(boolean,boolean) TO authenticated;
