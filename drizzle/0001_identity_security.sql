-- Supabase owns password/session storage. LUB preserves its own global identity.
ALTER TABLE lub.users ADD CONSTRAINT users_auth_identity_fk
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;
--> statement-breakpoint
REVOKE ALL ON SCHEMA lub FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA lub TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA lub FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON lub.users TO authenticated;
GRANT UPDATE (email, phone, email_verified_at, updated_at) ON lub.users TO authenticated;
GRANT SELECT, INSERT ON lub.student_profiles TO authenticated;
GRANT UPDATE (full_name_ar, major_name, academic_level, updated_at) ON lub.student_profiles TO authenticated;
GRANT SELECT, INSERT ON lub.profile_settings TO authenticated;
GRANT UPDATE (public_profile_enabled, show_total_hours, show_role_history, updated_at) ON lub.profile_settings TO authenticated;
GRANT INSERT ON lub.audit_log TO authenticated;
--> statement-breakpoint
CREATE POLICY users_read_self ON lub.users FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY users_insert_self ON lub.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND status_code = 'Active');
CREATE POLICY users_update_self ON lub.users FOR UPDATE TO authenticated
  USING (id = auth.uid() AND status_code = 'Active')
  WITH CHECK (id = auth.uid() AND status_code = 'Active');
--> statement-breakpoint
CREATE POLICY profile_read_self ON lub.student_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'));
CREATE POLICY profile_insert_self ON lub.student_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'));
CREATE POLICY profile_update_self ON lub.student_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'));
--> statement-breakpoint
CREATE POLICY settings_self ON lub.profile_settings FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'));
CREATE POLICY audit_insert_self ON lub.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users WHERE id = auth.uid() AND status_code = 'Active'));
--> statement-breakpoint
CREATE FUNCTION lub.reject_audit_mutation() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $$
  BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
  END;
$$;
REVOKE ALL ON FUNCTION lub.reject_audit_mutation() FROM PUBLIC;
CREATE TRIGGER audit_no_update_delete BEFORE UPDATE OR DELETE ON lub.audit_log
  FOR EACH ROW EXECUTE FUNCTION lub.reject_audit_mutation();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON lub.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION lub.reject_audit_mutation();
