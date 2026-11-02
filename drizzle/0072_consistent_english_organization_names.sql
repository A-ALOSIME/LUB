-- User-approved Latin display names. Only derived English cache entries change.
update lub.translations t set translated_text=n.english
from (values
 ('نادي ظهير','Dhaheer Club'),
 ('المجلس الاستشاري الطلابي لتقنية المعلومات','Information Technology Student Advisory Council'),
 ('المجلس الاستشاري الطلابي لقسم تقنية المعلومات','Information Technology Student Advisory Council'),
 ('المجلس الاستشاري الطلابي لنظم المعلومات','Information Systems Student Advisory Council'),
 ('المجلس الاستشاري لعلوم الحاسب','Computer Science Student Advisory Council'),
 ('المجلس الطلابي','Student Council'),
 ('مجتمع OSS','OSS Community'),
 ('نادي IEEE','IEEE Club'),
 ('نادي RobotX','RobotX Club'),
 ('نادي الأمن السيبراني','Cybersecurity Club'),
 ('نادي الإنجاز','Enjaz Club'),
 ('نادي تكنيشن','TechNation Club'),
 ('نادي طويق','Tuwaiq Club'),
 ('نادي إنجاز','Enjaz Club')
) n(arabic,english) where t.target_lang='EN' and t.source_text=n.arabic;
--> statement-breakpoint
update lub.translations set translated_text=replace(replace(replace(replace(replace(replace(replace(replace(translated_text,'الإنجاز','Enjaz'),'إنجاز','Enjaz'),'تكنيشن','TechNation'),'ظهير','Dhaheer'),'طويق','Tuwaiq'),'لُـبّ','LUB'),'لُبّ','LUB'),'لُب','LUB') where target_lang='EN';
