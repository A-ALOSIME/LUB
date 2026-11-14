import type {Locale} from "@/lib/preferences";

type Organization = {id:string;nameAr:string;canEdit?:boolean;canManageCommittees?:boolean};
type Label = readonly [string,string];
type Crumb = {label:string;href?:string};
const subpages:Record<string,Record<string,Label>>={
  "/activity":{tasks:["المهام","Tasks"],events:["الفعاليات","Events"],hours:["الساعات","Hours"]},
  "/applications":{applications:["طلبات الانضمام","Membership applications"],renewals:["التجديدات","Renewals"],organizations:["طلبات فتح الأندية","Club opening requests"]},
  "/manage/organizations":{requests:["طلبات فتح الأندية","Club opening requests"]},
  events:{events:["الفعاليات","Events"],registrants:["المسجلون في الفعاليات","Event registrants"],announcements:["الإعلانات","Announcements"]},
  members:{applications:["طلبات الانضمام","Membership applications"],roles:["الأدوار والصلاحيات","Roles and permissions"]},
  renewals:{forms:["النماذج","Forms"]},
  tasks:{tasks:["المهام","Tasks"],hours:["الساعات","Hours"]},
};

const pages:Record<string,Label>={
  "/me":["نظرة عامة","Overview"],
  "/account":["بيانات الحساب","Account details"],
  "/account/talent":["ملفي المهاري","Skills profile"],
  "/applications":["طلباتي","My requests"],
  "/activity":["نشاطي","My activity"],
  "/notifications":["الإشعارات","Notifications"],
  "/renewals":["تجديداتي","My renewals"],
  "/manage":["لوحة الإدارة","Management overview"],
  "/manage/account":["بيانات الحساب","Account details"],
  "/manage/organizations":["الجهات","Organizations"],
  "/manage/admins":["المشرفون العامون","Administrators"],
  "/manage/terms":["الفصول الأكاديمية","Academic terms"],
};
const sections:Record<string,Label>={
  members:["الأعضاء","Members"],
  renewals:["التسجيل والتجديد","Registration and renewal"],
  events:["الفعاليات والإعلانات","Events and announcements"],
  tasks:["المهام والساعات","Tasks and hours"],
};
const taskDetails:Label=["تفاصيل المهمة","Task details"];

export function workspaceBreadcrumbs(pathname:string,locale:Locale,organizations:Organization[],detail?:{label:string;organization?:string},search=""):Crumb[] {
  const path=pathname.replace(/\/$/,"");
  const text=([ar,en]:Label)=>locale==="en"?en:ar;
  const crumb=(label:Label,href?:string)=>({label:text(label),href});
  const known=(href:string)=>crumb(pages[href],href);
  const workspace=crumb(["مساحتي","Workspace"],"/me");
  const manage=known("/manage");
  const query=new URLSearchParams(search);
  const subpage=(page:string,param:string)=>{
    const value=query.get(param);
    const options=subpages[page];
    return value&&options&&Object.hasOwn(options,value)?options[value]:undefined;
  };
  const [area,group,id,section,item]=path.split("/").filter(Boolean);
  if(path==="/manage")return [manage];
  if(path==="/manage/organizations/new")return [manage,known("/manage/organizations"),crumb(["إضافة جهة","Add organization"])];
  const orgId=area==="manage"&&group==="organizations"?id:area==="registration"&&group==="renewal"?detail?.organization:undefined;
  if(orgId){
    const org=organizations.find(entry=>entry.id===orgId);
    const root=`/manage/organizations/${orgId}`;
    if(section==="edit")return [manage,known("/manage/organizations"),{label:detail?.label??org?.nameAr??text(["تعديل الجهة","Edit organization"])}];
    const organization={label:org?.nameAr??text(["الجهة","Organization"]),href:org&&(org.canEdit||org.canManageCommittees)?root:undefined};
    const trail=[workspace,organization];
    if(area==="registration")return [...trail,crumb(sections.renewals,`${root}/renewals`),{label:detail?.label??text(["نتائج التجديد","Renewal results"])}];
    if(section==="tasks"&&item)return [...trail,crumb(sections.tasks,`${root}/tasks`),{label:detail?.label??text(taskDetails)}];
    if(section==="applications"&&item)return [...trail,crumb(sections.members,`${root}/members`),crumb(["طلبات الانضمام","Membership applications"],`${root}/members?section=applications`),crumb(["تفاصيل الطلب","Application details"])];
    if(section&&Object.hasOwn(sections,section)){
      const selected=subpage(section,"section");
      if(section==="renewals"&&query.has("template")&&detail)return [...trail,crumb(sections.renewals,`${root}/renewals`),crumb(subpages.renewals.forms,`${root}/renewals?section=forms`),{label:detail.label}];
      if(selected)return [...trail,crumb(sections[section],`${root}/${section}`),crumb(selected)];
      return [...trail,crumb(sections[section])];
    }
    if(!section)return trail;
  }
  if(area==="tasks"&&group)return [workspace,known("/activity"),crumb(["المهام","Tasks"],"/activity?tab=tasks"),{label:detail?.label??text(taskDetails)}];
  if(area==="registration"&&group==="renewal")return [workspace,crumb(["نتائج التجديد","Renewal results"])];
  const label=Object.hasOwn(pages,path)?pages[path]:["الصفحة الحالية","Current page"] as const;
  const selected=subpage(path,"tab");
  return [area==="manage"?manage:workspace,crumb(label,selected?path:undefined),...(selected?[crumb(selected)]:[])];
}
