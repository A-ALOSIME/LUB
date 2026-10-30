// Public English display names; original Arabic names and identifiers stay unchanged.
const names:Record<string,string>={
  "نادي ظهير": "Dhaheer Club",
  "المجلس الاستشاري الطلابي لتقنية المعلومات": "Information Technology Student Advisory Council",
  "المجلس الاستشاري الطلابي لقسم تقنية المعلومات": "Information Technology Student Advisory Council",
  "المجلس الاستشاري الطلابي لنظم المعلومات": "Information Systems Student Advisory Council",
  "المجلس الاستشاري لعلوم الحاسب": "Computer Science Student Advisory Council",
  "المجلس الطلابي": "Student Council",
  "مجتمع OSS": "OSS Community",
  "نادي IEEE": "IEEE Club",
  "نادي RobotX": "RobotX Club",
  "نادي الأمن السيبراني": "Cybersecurity Club",
  "نادي الإنجاز": "Enjaz Club",
  "نادي تكنيشن": "Technician Club",
  "نادي طويق": "Tuwaiq Club",
  "نادي إنجاز": "Enjaz Club"
};
const expression=new RegExp(Object.keys(names).sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"gu");
export function translateOrganizationNames(text:string){return text.replace(expression,name=>names[name]);}
