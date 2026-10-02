-- These SECURITY DEFINER functions return only the explicitly public talent projection.
-- Grant the Worker login this narrow access so anonymous page reads do not need a
-- transaction just to SET ROLE anon before calling them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lub_runtime') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA lub TO lub_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION lub.talent_directory(text,text,int), lub.public_talent(uuid,int,int,int) TO lub_runtime';
  END IF;
END;
$$;
