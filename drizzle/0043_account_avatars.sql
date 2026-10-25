INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('lub-avatars','lub-avatars',false,65536,ARRAY['image/webp']);
--> statement-breakpoint
GRANT UPDATE ON storage.objects TO authenticated;
--> statement-breakpoint
CREATE POLICY account_avatar_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active')) ;
--> statement-breakpoint
CREATE POLICY account_avatar_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active'));
--> statement-breakpoint
CREATE POLICY account_avatar_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active')) WITH CHECK (bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active'));
--> statement-breakpoint
CREATE POLICY account_avatar_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active')) ;
--> statement-breakpoint
