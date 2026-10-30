"use client";
import {useEffect,useSyncExternalStore} from "react";
import {useI18n} from "@/components/i18n-provider";
import {useActivityCache} from "./activity-cache";
import {activityHours} from "./activity-data";
import {ActivityTabs} from "./activity-tabs";
import {ActivityHours,ActivityEventRows} from "./activity-views";
import {TaskBrowser} from "@/features/tasks/task-browser";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {Skeleton} from "@/components/ui/skeleton";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("activity-tab-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("activity-tab-change",notify);};}
function change(values:Record<string,string|null>){const params=new URLSearchParams(window.location.search);params.delete("page");for(const [key,value] of Object.entries(values))if(value===null||value==="all"||value==="0")params.delete(key);else params.set(key,value);window.history.pushState(window.history.state,"",`/activity?${params}`);window.dispatchEvent(new Event("activity-tab-change"));}
export function ActivityScreen(){
 const {locale,dir,t}=useI18n(),{data,error,ensure,refresh}=useActivityCache();
 const search=useSyncExternalStore(subscribe,()=>window.location.search,()=>"");
 useEffect(()=>{void ensure();},[ensure]);
 const params=new URLSearchParams(search),tab=params.get("tab")==="events"?"events":params.get("tab")==="hours"?"hours":"tasks";
 if(!data)return <main id="main" dir={dir} className="flex min-w-0 flex-col gap-4"><header className="workspace-page-header"><h1>{t("نشاطي","My activity")}</h1></header>{error?<Alert variant="destructive"><AlertDescription>{t("تعذّر تحميل نشاطك. حاول مجددًا.","Could not load your activity. Please try again.")}</AlertDescription><Button variant="outline" onClick={()=>void refresh()}>{t("إعادة المحاولة","Retry")}</Button></Alert>:<div role="status" aria-label={t("جارٍ تحميل نشاطك","Loading activity")} className="flex flex-col gap-4"><Skeleton className="h-10 w-72"/><Skeleton className="h-40 w-full"/></div>}</main>;
 const page=(key:string,total:number)=>Math.min(Math.max(0,Math.floor((total-1)/25)),Math.max(0,Math.floor(Number(params.get(key)??(tab===key.replace("Page","")?params.get("page"):0))||0)));
 const term=data.hours.terms.some(v=>v.id===params.get("term"))?params.get("term"):null;
 const status=(["approved","pending","rejected"] as const).find(v=>v===params.get("hourStatus"))??"all";
 const hours=activityHours(data.hours,term,status),hourPage=page("hoursPage",hours.records.length);
 const eventState=["pending","accepted","rejected","cancelled"].find(v=>v===params.get("eventStatus"))??"all",eventMatches=(e:typeof data.events[number])=>eventState==="all"||eventState==="cancelled"&&e.registration==="Cancelled"||e.registration!=="Cancelled"&&(eventState==="pending"?e.review_status==="Pending":eventState==="rejected"?e.review_status==="Rejected":eventState==="accepted"&&e.review_status!=="Pending"&&e.review_status!=="Rejected");
 const events=data.events.filter(eventMatches),eventPage=page("eventsPage",events.length);
 const view=params.get("taskFilter")==="mine"?"mine":"available",taskPage=page("tasksPage",(view==="mine"?data.mine:data.tasks).length);
 const eventOptions=[{value:"all",label:t("الكل","All"),count:data.events.length},{value:"pending",label:t("بانتظار","Pending"),count:data.events.filter(e=>e.registration!=="Cancelled"&&e.review_status==="Pending").length},{value:"accepted",label:t("مقبول","Accepted"),count:data.events.filter(e=>e.registration!=="Cancelled"&&e.review_status!=="Pending"&&e.review_status!=="Rejected").length},{value:"rejected",label:t("مرفوض","Rejected"),count:data.events.filter(e=>e.registration!=="Cancelled"&&e.review_status==="Rejected").length},{value:"cancelled",label:t("ملغي","Cancelled"),count:data.events.filter(e=>e.registration==="Cancelled").length}];
 return <main id="main" dir={dir} className="flex min-w-0 flex-col gap-4 pb-20 lg:pb-0"><header className="workspace-page-header"><h1>{t("نشاطي","My activity")}</h1></header><ActivityTabs initialTab={tab} locale={locale}
  tasks={<TaskBrowser initialView={view} page={taskPage} availableItems={data.tasks.slice(taskPage*25,taskPage*25+25)} mineItems={data.mine.slice(taskPage*25,taskPage*25+25)} availableMore={data.tasks.length>(taskPage+1)*25} mineMore={data.mine.length>(taskPage+1)*25} locale={locale} base="/activity" compact onViewChange={view=>change({taskFilter:view,tasksPage:null})} onPageChange={page=>change({tasksPage:String(page)})}/>}
  events={<div className="flex min-w-0 flex-col gap-4"><FilterTabs ariaLabel={t("حالة التسجيل في الفعاليات","Event registration status")} value={eventState} options={eventOptions} dir={dir} onValueChange={value=>change({eventStatus:value,eventsPage:null})}/><ActivityEventRows events={events.slice(eventPage*25,eventPage*25+26)} page={eventPage} locale={locale} onPageChange={page=>change({eventsPage:String(page)})}/></div>}
  hours={<ActivityHours data={{...hours,records:hours.records.slice(hourPage*25,hourPage*25+26)}} page={hourPage} term={term} status={status} locale={locale} onFiltersChange={changes=>change({...(changes.term!==undefined?{term:changes.term}:{}),...(changes.status?{hourStatus:changes.status}:{}),hoursPage:null})} onPageChange={page=>change({hoursPage:String(page)})}/>}
 /></main>;
}
