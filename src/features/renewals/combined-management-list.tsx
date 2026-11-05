"use client";
import {useMemo} from "react";
import {useOptimisticRows} from "@/lib/optimistic-rows";
import type {CampaignItem} from "./campaign-list-types";
import type {ReactNode} from "react";
import {CalendarRange,RefreshCw,Search} from "lucide-react";
import {ItemTable,ItemTitle} from "@/components/item-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {ListEmpty} from "@/components/list-empty";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {StatusFilter} from "@/components/status-filter";
import {Badge} from "@/components/ui/badge";


import {ContentText} from "@/components/content-text";
import {useListQuery} from "@/lib/list-query";
import {createTranslator} from "@/lib/i18n";
import {formatRiyadhPeriod} from "@/lib/datetime";

import {arabicSearchKey} from "@/features/talent/skill-normalization";
import {RoundForm} from "@/features/forms/round-actions";

import {CampaignLifecycleControls} from "./lifecycle-controls";
import type {Round} from "@/features/forms/repository";
import type {Campaign,RenewalWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
type Item=CampaignItem;
export function CombinedManagementList({rounds,campaigns,organization,locale,canManageRounds,canManageCampaigns=true,emptyAction,templates=[],serverRows,serverPaged=false,pagination}:{pagination?:import("@/components/data-table").DataTablePagination;serverRows?:Item[];serverPaged?:boolean;rounds:Round[];campaigns:Campaign[];organization:string;locale:Locale;canManageRounds:boolean;canManageCampaigns?:boolean;emptyAction?:ReactNode;templates?:Array<{id:string;name:string}>;terms?:RenewalWorkspace["terms"]}){
 const c=createTranslator(locale),{params,change}=useListQuery(),status=params.get("campaignStatus")??"all",kind=params.get("campaignType")??"all",q=params.get("campaignSearch")??"";

 void serverPaged;
 const sourceItems=useMemo<Item[]>(()=>serverRows??[...rounds.map(round=>({id:round.id,kind:"round" as const,title:round.title,opens:round.opens_at,closes:round.closes_at,status:round.status_code,round})),...campaigns.map(campaign=>({id:campaign.id,kind:"renewal" as const,title:campaign.name,opens:campaign.opens_at,closes:campaign.closes_at,status:campaign.status_code,campaign}))].sort((a,b)=>(Date.parse(b.opens)||0)-(Date.parse(a.opens)||0)),[serverRows,rounds,campaigns]);
 const projection=useOptimisticRows(sourceItems,item=>item.id),items=projection.items;
 const page=Math.max(0,Math.min(10000,Number(params.get("campaignPage"))||0));
 const visible=items.filter(item=>(status==="all"?item.status!=="Archived":item.status===status)&&(kind==="all"||item.kind===kind)&&arabicSearchKey(item.title).includes(arabicSearchKey(q)));
 const label=(value:string)=>({Draft:c("مسودة","Draft"),Open:c("مفتوحة","Open"),Paused:c("متوقفة","Paused"),Closed:c("مغلقة","Closed"),Archived:c("مؤرشفة","Archived")}[value]??value);
 const edit=(item:Item)=>item.round?<RoundForm value={item.round} organization={organization} templates={templates} locale={locale}/>:null;
 return <section className="flex min-w-0 flex-col gap-4"><SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" aria-label={c("بحث الحملات","Search campaigns")} placeholder={c("ابحث عن حملة","Search campaigns")} value={q} onChange={e=>change({campaignSearch:e.target.value,campaignPage:null},true)}/></InputGroup>}><StatusFilter value={status} onValueChange={value=>change({campaignStatus:value,campaignPage:null})} dir={locale==="ar"?"rtl":"ltr"} ariaLabel={c("حالة الحملة","Campaign status")} options={[["all",c("الكل","All")],...["Draft","Open","Paused","Closed","Archived"].map(value=>[value,label(value)])].map(([value,label])=>({value,label}))}/><FilterTabs value={kind} ariaLabel={c("نوع الحملة","Campaign type")} dir={locale==="ar"?"rtl":"ltr"} onValueChange={value=>change({campaignType:value,campaignPage:null})} options={[{value:"all",label:c("الكل","All")},{value:"round",label:c("تسجيل","Registration")},{value:"renewal",label:c("تجديد","Renewal")}]} />{emptyAction}</SearchFilterToolbar>
 <ItemTable pagination={pagination??{page,more:visible.length>(page+1)*25,onChange:value=>change({campaignPage:String(value)})}} items={visible} label={c("عرض الحملة","View campaign")} href={item=>item.kind==="renewal"?`/registration/renewal/${item.id}`:`/apply/${item.id}`} empty={<ListEmpty filtered={Boolean(q||kind!=="all"||status!=="all")} clear={()=>change({campaignSearch:null,campaignType:null,campaignStatus:null})} icon={CalendarRange} title={c("لا توجد حملات بعد","No campaigns yet")} description={c("أنشئ جولة تسجيل أو حملة تجديد للبدء.","Create a registration round or renewal campaign to begin.")}/>} columns={[
 {id:"name",label:c("الحملة","Campaign"),render:item=><div className="flex min-w-0 items-center gap-3"><ListThumbnail icon={item.kind==="round"?CalendarRange:RefreshCw}/><div className="min-w-0 flex-1"><ItemTitle><ContentText value={item.title}/></ItemTitle></div></div>},
 {id:"type",label:c("النوع","Type"),className:"w-20",render:item=>item.kind==="round"?c("تسجيل","Registration"):c("تجديد","Renewal")},
 {id:"period",label:c("الفترة","Period"),className:"w-32",render:item=><bdi className="whitespace-nowrap text-sm text-muted-foreground">{formatRiyadhPeriod(item.opens,item.closes,locale)}</bdi>},
 {id:"status",label:c("الحالة","Status"),className:"w-20",render:item=><Badge variant="outline">{label(item.status)}</Badge>},
 {id:"participants",label:c("المجددون / المسجلون","Renewed / registered"),className:"w-36",render:item=>item.campaign?.summary?.renewed??item.round?.application_count??0},
 {id:"actions",label:c("الإجراءات","Actions"),className:"w-96",render:item=><CampaignLifecycleControls kind={item.kind} id={item.id} title={item.title} status={item.status} organization={organization} locale={locale} optimistic={(status,remove)=>projection.change(item.id,row=>remove?null:{...row,status,round:row.round?{...row.round,status_code:status}:undefined,campaign:row.campaign?{...row.campaign,status_code:status}:undefined})} allowed={item.kind==="round"?canManageRounds:canManageCampaigns} editForm={edit(item)}/>}
 ]}/></section>;
}
