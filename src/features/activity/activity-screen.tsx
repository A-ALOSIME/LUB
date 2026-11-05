"use client";
import {SelfHoursRequestAction} from "@/features/hours/self-request-action";
import {ListEmpty} from "@/components/list-empty";
import {ClipboardCheck} from "lucide-react";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {NativeSelect} from "@/components/ui/native-select";
import {Search} from "lucide-react";
import {academicTerm} from "@/lib/display";
import {arabicSearchKey} from "@/features/talent/skill-normalization";
import {PagedActivityScreen} from "./paged-activity-screen";
import {ActivityHourFilter} from "./activity-hour-filter";
import {useEffect,useSyncExternalStore} from "react";
import {useI18n} from "@/components/i18n-provider";
import {useActivityCache} from "./activity-cache";
import {activityHours} from "./activity-data";
import {ActivityTabs} from "./activity-tabs";
import {ActivityHours,ActivityEventRows,ActivityAvailableEvents} from "./activity-views";
import {TaskBrowser} from "@/features/tasks/task-browser";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {Skeleton} from "@/components/ui/skeleton";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("activity-tab-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("activity-tab-change",notify);};}
function change(values:Record<string,string|null>){const params=new URLSearchParams(window.location.search);params.delete("page");for(const [key,value] of Object.entries(values))if(value===null||value==="all"||value==="0")params.delete(key);else params.set(key,value);window.history.pushState(window.history.state,"",`/activity?${params}`);window.dispatchEvent(new Event("activity-tab-change"));}
export function ActivityScreen(){
 const {locale,dir,t}=useI18n(),{data,error,ensure,refresh,cancel}=useActivityCache();
 const search=useSyncExternalStore(subscribe,()=>window.location.search,()=>"");
 useEffect(()=>{void ensure();return cancel;},[ensure,cancel]);
 const params=new URLSearchParams(search),tab=params.get("tab")==="events"?"events":params.get("tab")==="hours"?"hours":"tasks";
 if(!data)return <main id="main" dir={dir} className="flex min-w-0 flex-col gap-4"><header className="workspace-page-header"><h1>{t("نشاطي","My activity")}</h1></header>{error?<Alert variant="destructive"><AlertDescription>{t("تعذّر تحميل نشاطك. حاول مجددًا.","Could not load your activity. Please try again.")}</AlertDescription><Button variant="outline" onClick={()=>void refresh()}>{t("إعادة المحاولة","Retry")}</Button></Alert>:<div role="status" aria-label={t("جارٍ تحميل نشاطك","Loading activity")} className="flex flex-col gap-4"><Skeleton className="h-10 w-72"/><Skeleton className="h-40 w-full"/></div>}</main>;
 if(data.paged)return <PagedActivityScreen snapshot={data}/>;
 const q=params.get('q')??'',matches=(value:string)=>arabicSearchKey(value).includes(arabicSearchKey(q));
 const available=data.tasks.filter(x=>matches(`${x.task.title} ${x.org_name}`)),mine=data.mine.filter(x=>matches(`${x.task.title} ${x.org_name}`));
 const page=(key:string,total:number)=>Math.min(Math.max(0,Math.floor((total-1)/25)),Math.max(0,Math.floor(Number(params.get(key)??(tab===key.replace("Page","")?params.get("page"):0))||0)));
 const term=data.hours.terms.some(v=>v.id===params.get("term"))?params.get("term"):null;
 const status=(["approved","pending","rejected"] as const).find(v=>v===params.get("hourStatus"))??"all";
 const hours=activityHours({...data.hours,records:data.hours.records.filter(x=>matches(`${x.org_name} ${x.description}`))},term,status),hourPage=page("hoursPage",hours.records.length);
 const eventState=["pending","accepted","rejected","cancelled"].find(v=>v===params.get("eventStatus"))??"all",eventMatches=(e:typeof data.events[number])=>eventState==="all"||eventState==="cancelled"&&e.registration==="Cancelled"||e.registration!=="Cancelled"&&(eventState==="pending"?e.review_status==="Pending":eventState==="rejected"?e.review_status==="Rejected":eventState==="accepted"&&e.review_status!=="Pending"&&e.review_status!=="Rejected");
 const eventView=params.get("eventView")==="available"?"available":"mine",availableEvents=(data.availableEvents??[]).filter(event=>matches(`${event.title} ${event.org_name}`));
 const events=data.events.filter(x=>eventMatches(x)&&matches(x.title)),eventPage=page("eventsPage",events.length);
 const view=params.get("taskFilter")==="mine"?"mine":"available",taskPage=page("tasksPage",(view==="mine"?mine:available).length);
 const empty=(q||tab==="hours"&&(term||status!=="all")||tab==="events"&&eventState!=="all")?<ListEmpty filtered clear={()=>change({q:null,term:null,hourStatus:null,eventStatus:null,tasksPage:null,eventsPage:null,hoursPage:null})} icon={ClipboardCheck} title="" description=""/>:undefined;
 const countedEvents=data.hours.isTest?[]:data.events;
 const eventOptions=[{value:"all",label:t("الكل","All"),count:countedEvents.length},{value:"pending",label:t("بانتظار","Pending"),count:countedEvents.filter(e=>e.registration!=="Cancelled"&&e.review_status==="Pending").length},{value:"accepted",label:t("مقبول","Accepted"),count:countedEvents.filter(e=>e.registration!=="Cancelled"&&e.review_status!=="Pending"&&e.review_status!=="Rejected").length},{value:"rejected",label:t("مرفوض","Rejected"),count:countedEvents.filter(e=>e.registration!=="Cancelled"&&e.review_status==="Rejected").length},{value:"cancelled",label:t("مسحوب","Withdrawn"),count:countedEvents.filter(e=>e.registration==="Cancelled").length}];
 return <main id="main" dir={dir} className="flex min-w-0 flex-col gap-4 pb-20 lg:pb-0"><header className="workspace-page-header"><h1>{t("نشاطي","My activity")}</h1></header><ActivityTabs initialTab={tab} locale={locale}
 search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" value={q} aria-label={t("البحث في نشاطي","Search my activity")} placeholder={t("ابحث في نشاطك…","Search your activity…")} onChange={event=>change({q:event.target.value||null,tasksPage:null,eventsPage:null,hoursPage:null})}/></InputGroup>}
 filters={tab==='tasks'?<FilterTabs value={view} ariaLabel={t("تصفية المهام","Task filters")} dir={dir} onValueChange={value=>change({taskFilter:value,tasksPage:null})} options={[{value:'available',label:t("المتاحة","Available")},{value:'mine',label:t("مشاركاتي","My participation")}]} />:tab==='events'?<><FilterTabs value={eventView} ariaLabel={t("الظهور","Visibility")} dir={dir} onValueChange={value=>change({eventView:value,eventsPage:null})} options={[{value:'available',label:t("المتاحة","Available")},{value:'mine',label:t("مشاركاتي","My participation")}]}/>{eventView==='mine'&&<FilterTabs ariaLabel={t("حالة التسجيل في الفعاليات","Event registration status")} value={eventState} options={eventOptions} dir={dir} onValueChange={value=>change({eventStatus:value,eventsPage:null})}/>}</>:<><NativeSelect className="w-auto" aria-label={t("الفصل الدراسي","Academic term")} value={term??""} onChange={event=>change({term:event.target.value||null,hoursPage:null})}><option value="">{t("كل الفصول","All terms")}</option>{data.hours.terms.map(item=><option key={item.id} value={item.id}>{academicTerm(item.name_ar,locale)} · {item.academic_year}</option>)}</NativeSelect><ActivityHourFilter value={status} locale={locale} onChange={value=>change({hourStatus:value,hoursPage:null})}/><SelfHoursRequestAction memberships={data.hours.memberships} locale={locale}/></>}

  tasks={<TaskBrowser empty={empty} initialView={view} page={taskPage} hideFilters availableItems={available} mineItems={mine} availableMore={available.length>(taskPage+1)*25} mineMore={mine.length>(taskPage+1)*25} locale={locale} base="/activity" compact onViewChange={view=>change({taskFilter:view,tasksPage:null})} onPageChange={page=>change({tasksPage:String(page)})}/>}
  events={<div className="flex min-w-0 flex-col gap-4"> {eventView==="available"?<ActivityAvailableEvents empty={empty} events={availableEvents} locale={locale}/>:<ActivityEventRows empty={empty} events={events} hidePagination page={eventPage} locale={locale} onPageChange={page=>change({eventsPage:String(page)})}/>}</div>}
  hours={<ActivityHours empty={empty} hideFilters data={hours} hidePagination page={hourPage} term={term} status={status} locale={locale} onFiltersChange={changes=>change({...(changes.term!==undefined?{term:changes.term}:{}),...(changes.status?{hourStatus:changes.status}:{}),hoursPage:null})} onPageChange={page=>change({hoursPage:String(page)})}/>}
 /></main>;
}
