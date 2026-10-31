INSERT INTO lub.skill_dictionary(key,name_ar,name_en,category_code,aliases) VALUES
('network-security-analysis','تحليل الشبكات وأمن المعلومات','Network Analysis and Information Security','security','["تحليل الشبكات وأمن المعلومات","Network Analysis and Information Security"]'::jsonb),
('server-administration','إدارة خوادم لينكس وويندوز','Linux & Windows Server Administration','networks','["إدارة خوادم لينكس وويندوز","Linux & Windows Server Administration"]'::jsonb),
('cryptography-security-protocols','أساسيات التشفير وبروتوكولات الأمان (SSL/TLS, VPN)','Cryptography and Security Protocols (SSL/TLS, VPN)','security','["أساسيات التشفير وبروتوكولات الأمان (SSL/TLS, VPN)","Cryptography and Security Protocols (SSL/TLS, VPN)"]'::jsonb);
--> statement-breakpoint
UPDATE lub.skills SET name_ar=name_ar WHERE dictionary_key IS NULL;
