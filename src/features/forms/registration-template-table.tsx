"use client";
import {Files,Search} from "lucide-react";
import {ItemTable,ItemTitle} from "@/components/item-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {ListEmpty} from "@/components/list-empty";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {Badge} from "@/components/ui/badge";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {useListQuery} from "@/lib/list-query";
import {createTranslator} from "@/lib/i18n";
import {formatCount} from "@/lib/display";
import {relativeDate} from "@/lib/relative-date";
import {arabicSearchKey} from "@/features/talent/skill-normalization";
import {RegistrationTemplateRow} from "./registration-template-row";
import type {Template} from "./repository";
import type {Locale} from "@/lib/preferences";
export function RegistrationTemplateTable({items,organization,locale,actions}:{serverPaged?:boolean;actions?:import("react").ReactNode;items:Template[];organization:string;locale:Locale}){
 const c=createTranslator(locale),{params,change}=useListQuery(),q=params.get("formSearch")??"",status=params.get("formStatus")??"all";

 const state=(item:Template)=>item.versions[0]?.status_code==="Draft"?"Draft":item.versions.some(v=>v.status_code==="Published")?"Published":"Draft";
 const rows=items.filter(item=>(status==="all"||state(item)===status)&&arabicSearchKey(item.name).includes(arabicSearchKey(q)));
 return <section className="flex min-w-0 flex-col gap-4"><SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" aria-label={c("بحث النماذج","Search forms")} placeholder={c("ابحث عن نموذج","Search forms")} value={q} onChange={e=>change({formSearch:e.target.value,formPage:null},true)}/></InputGroup>}><FilterTabs value={status} onValueChange={value=>change({formStatus:value,formPage:null})} ariaLabel={c("حالة النموذج","Form status")} dir={locale==="ar"?"rtl":"ltr"} options={[{value:"all",label:c("الكل","All")},{value:"Draft",label:c("مسودة","Draft")},{value:"Published",label:c("منشورة","Published")}]}/>{actions}</SearchFilterToolbar><ItemTable items={rows} href={item=>`/manage/organizations/${organization}/renewals?section=forms&template=${item.id}`} label={c("فتح النموذج","Open form")} empty={<ListEmpty icon={Files} filtered={Boolean(q||status!=="all")} clear={()=>change({formSearch:null,formStatus:null})} title={c("لا توجد نماذج بعد","No forms yet")} description={c("أنشئ نموذجًا لبدء استقبال الطلبات.","Create a form to start accepting applications.")}/>} columns={[
 {id:"name",label:c("النموذج","Form"),render:item=><div className="flex min-w-0 items-center gap-3"><ListThumbnail icon={Files}/><div className="min-w-0 flex-1"><ItemTitle>{item.name}</ItemTitle><p className="text-sm text-muted-foreground">{formatCount(item.version_count??item.versions.length,"versions",locale)} · {(item.round_count??0)===0?c("غير مستخدم في أي جولة","Not used in any round"):formatCount(item.round_count!,"rounds",locale)}{item.updated_at&&<> · {relativeDate(item.updated_at,locale)}</>}</p></div></div>},
 {id:"status",label:c("الحالة","Status"),className:"w-28",render:item=><Badge variant="outline">{state(item)==="Draft"?c("مسودة","Draft"):c("منشور","Published")}</Badge>},
 {id:"actions",label:c("الإجراءات","Actions"),className:"w-36",render:item=><RegistrationTemplateRow template={item} organization={organization} locale={locale} actionsOnly/>}
 ]}/></section>;
}
