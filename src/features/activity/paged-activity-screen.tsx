"use client";
import {ListEmpty} from "@/components/list-empty";
import {ClipboardCheck} from "lucide-react";
import {useEffect,useMemo} from "react";
import {useQuery,useQueryClient,queryOptions,keepPreviousData} from "@tanstack/react-query";
import {Search} from "lucide-react";
import {useQueryActor} from "@/components/private-query-provider";
import {useI18n} from "@/components/i18n-provider";
import {useListQuery} from "@/lib/list-query";
import {completeList} from "@/lib/complete-list";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {NativeSelect} from "@/components/ui/native-select";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {ActivityTabs,type ActivityTab} from "./activity-tabs";
import {ActivityEventRows,ActivityHours,ActivityAvailableEvents} from "./activity-views";
import {TaskList} from "@/features/tasks/task-list";
import {ActivityHourFilter} from "./activity-hour-filter";
import type {ActivitySnapshot} from "./activity-data";
import type {HoursData} from "@/features/hours/repository";
import type {TaskCard} from "@/features/tasks/repository";
import type {EventCard} from "@/features/events/repository";
type Filters={tab:ActivityTab;view:"available"|"mine";q:string;status:string;term:string;page:number;sort:"asc"|"desc"};
type Page={items?:TaskCard[];more?:boolean;events?:ActivitySnapshot["events"];available?:EventCard[]}&Partial<HoursData>;
function options(actor:string|null,f:Filters){const params=new URLSearchParams({...f,page:String(f.page)});if(!f.term)params.delete("term");return queryOptions({queryKey:["activity-page",actor,f],queryFn:({signal})=>completeList<Page>(`/api/activity?${params}`,signal)});}
export function PagedActivityScreen({snapshot}:{snapshot:ActivitySnapshot}){
 const {t,locale,dir}=useI18n(),actor=useQueryActor(),client=useQueryClient(),{params,change}=useListQuery();
 const tab:ActivityTab=params.get("tab")==="hours"?"hours":params.get("tab")==="events"?"events":"tasks";
 const f=useMemo<Filters>(()=>({tab,view:tab==="tasks"?params.get("taskFilter")==="mine"?"mine":"available":params.get("eventView")==="available"?"available":"mine",q:(params.get("q")??"").slice(0,120),status:params.get(tab==="hours"?"hourStatus":"eventStatus")??"all",term:params.get("term")??"",page:0,sort:params.get("sort")==="asc"?"asc":"desc"}),[params,tab]);

 const result=useQuery({...options(actor,f),placeholderData:keepPreviousData}),data=result.data;
 useEffect(()=>{for(const tab of ["tasks","events","hours"] as const)for(const view of tab==="hours"?["mine"] as const:["available","mine"] as const)for(const status of tab==="hours"?["all","approved","pending","rejected"]:tab==="events"&&view==="mine"?["all","pending","accepted","rejected","cancelled"]:["all"])void client.prefetchQuery(options(actor,{tab,view,status,q:"",term:"",page:0,sort:"desc"}));return()=>{void client.cancelQueries({queryKey:["activity-page",actor]});};},[actor,client]);
 useEffect(()=>{const changed=()=>{void client.invalidateQueries({queryKey:["activity-page",actor]});};window.addEventListener("activity-changed",changed);return()=>window.removeEventListener("activity-changed",changed);},[actor,client]);
 const update=(values:Record<string,string|null>,replace=false)=>{change({[`${tab}Page`]:null,...values},replace);window.dispatchEvent(new Event("activity-tab-change"));};

 const empty=<ListEmpty filtered={Boolean(f.q||f.term||f.status!=="all")} clear={()=>update({q:null,term:null,hourStatus:null,eventStatus:null})} icon={ClipboardCheck} title={t("لا توجد عناصر بعد","No items yet")} description={t("تظهر مشاركاتك هنا.","Your participation appears here.")}/>;
 const events=f.view==="available"?<ActivityAvailableEvents empty={empty} events={data?.available??snapshot.availableEvents??[]} locale={locale}/>:<ActivityEventRows empty={empty} events={data?.events??snapshot.events} page={f.page} locale={locale} hidePagination/>;
 return <main id="main" dir={dir} className="flex min-w-0 flex-col gap-4"><header className="workspace-page-header"><h1>{t("نشاطي","My activity")}</h1></header>{result.isError&&<Alert><AlertDescription>{t("تعذّر تحديث النتائج. حاول مجدداً.","Could not refresh results. Try again.")}</AlertDescription></Alert>}<ActivityTabs initialTab={tab} locale={locale}
 search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput value={f.q} aria-label={t("البحث في نشاطي","Search my activity")} placeholder={t("ابحث في نشاطك","Search your activity")} onChange={e=>update({q:e.target.value},true)}/></InputGroup>}
 filters={tab==="hours"?<><NativeSelect aria-label={t("الفصل الدراسي","Academic term")} value={f.term} onChange={e=>update({term:e.target.value})}><option value="">{t("كل الفصول","All terms")}</option>{snapshot.hours.terms.map(term=><option value={term.id} key={term.id}>{term.name_ar}</option>)}</NativeSelect><ActivityHourFilter value={f.status==="approved"||f.status==="pending"||f.status==="rejected"?f.status:"all"} locale={locale} onChange={value=>update({hourStatus:value})}/></>:<><FilterTabs value={f.view} ariaLabel={t("الظهور","Visibility")} dir={dir} options={[{value:"available",label:t("المتاحة","Available")},{value:"mine",label:t("مشاركاتي","My participation")}]} onValueChange={value=>update({[tab==="tasks"?"taskFilter":"eventView"]:value})}/>{tab==="events"&&f.view==="mine"&&<FilterTabs value={f.status} ariaLabel={t("حالة التسجيل","Registration status")} dir={dir} options={[{value:"all",label:t("الكل","All")},{value:"pending",label:t("بانتظار","Pending")},{value:"accepted",label:t("مقبول","Accepted")},{value:"rejected",label:t("مرفوض","Rejected")},{value:"cancelled",label:t("ملغي","Cancelled")}]} onValueChange={value=>update({eventStatus:value})}/>}</>}
 tasks={<TaskList empty={empty} items={data?.items??(f.view==="mine"?snapshot.mine:snapshot.tasks)} mode={f.view} locale={locale}/>}
 events={events}
 hours={<ActivityHours empty={empty} data={data?.records?data as HoursData:{...snapshot.hours,records:snapshot.hours.records}} page={f.page} term={f.term||null} status={f.status==="approved"||f.status==="pending"||f.status==="rejected"?f.status:"all"} locale={locale} hideFilters hidePagination/>}/>
</main>;
}
