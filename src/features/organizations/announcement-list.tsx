"use client";

import {useOptimisticRows} from "@/lib/optimistic-rows";
import {ContentText} from "@/components/content-text";
import {actionFeedback} from "@/lib/action-feedback";
import {createTranslator,t as translateUi} from "@/lib/i18n";
import {useState,useActionState,startTransition} from "react";
import {ItemTable,ItemTitle} from "@/components/item-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {ListEmpty} from "@/components/list-empty";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {useListQuery} from "@/lib/list-query";
import {arabicSearchKey} from "@/features/talent/skill-normalization";
import {Search} from "lucide-react";
import {Megaphone,Pin,PinOff,Archive,Trash2,Pencil,Eye} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";

import {AnnouncementDialog} from "@/app/(workspace)/manage/organizations/[id]/announcement-dialog";
import {useActionToast} from "@/components/action-toast";
import {mutateOrganization} from "./actions";
import {OrganizationStatusBadge} from "./organization-status-badge";
import {formatRiyadhDate} from "@/lib/datetime";
import type {ManagedAnnouncement} from "./announcement-types";
import type {MutationState} from "./validation";
import type {Locale} from "@/lib/preferences";
function AnnouncementDecision({item,org,kind,locale,optimistic}:{optimistic?:(kind:"pin"|"archive"|"delete")=>()=>void;item:ManagedAnnouncement;org:string;kind:"pin"|"archive"|"delete";locale:Locale}){
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState<MutationState,FormData>(async(previous,form)=>{const undo=optimistic?.(kind);let result;try{result=await mutateOrganization(previous,form);}catch{undo?.();return {error:translateUi(locale,"تعذّر حفظ التغيير. حاول مجددًا.","Could not save changes. Try again.")};}if(result.error)undo?.();if(result.success){setOpen(false);window.dispatchEvent(new CustomEvent("organization-events-changed",{detail:{organization:org}}));}return result;},{});useActionToast(state,locale);
 const en=locale==="en",label=kind==="pin"?(item.pinned?(translateUi((en) ? "en" : "ar", "فك التثبيت", "Unpin")):(translateUi((en) ? "en" : "ar", "تثبيت الإعلان", "Pin"))):kind==="archive"?(translateUi((en) ? "en" : "ar", "أرشفة الإعلان", "Archive announcement")):(translateUi((en) ? "en" : "ar", "حذف الإعلان", "Delete announcement")),Icon=kind==="pin"?(item.pinned?PinOff:Pin):kind==="archive"?Archive:Trash2;
 const data=()=>{const f=new FormData();f.set("operation",`${kind}-announcement`);f.set("organizationId",org);f.set("announcementId",item.id);f.set("confirmed","on");f.set("pinned",item.pinned?"":"on");return f;};
 return <><RowAction label={label} hint={kind==="delete"&&(item.published||item.archived)?translateUi(locale,"الحذف متاح للمسودات فقط","Only drafts can be deleted"):undefined} danger={kind==="delete"} disabled={pending||(kind==="delete"&&(item.published||item.archived))||(kind==="pin"&&(!item.published||item.archived))||(kind==="archive"&&item.archived)} onClick={()=>kind==="pin"?startTransition(()=>action(data())):setOpen(true)}><Icon/></RowAction><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{label}: <ContentText value={item.title}/>{translateUi((en) ? "en" : "ar", "؟", "?")}</AlertDialogTitle><AlertDialogDescription>{kind==="delete"?(translateUi((en) ? "en" : "ar", "سيُحذف الإعلان من القائمة ومن الصفحة العامة.", "The announcement will be removed from management and the public page.")):(translateUi((en) ? "en" : "ar", "سيُنقل الإعلان إلى الأرشيف ويختفي من الصفحة العامة.", "The announcement will be archived and hidden from the public page."))}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button variant={kind==="delete"?"destructive":"default"} disabled={pending} onClick={()=>startTransition(()=>action(data()))}>{label}</Button><AlertDialogCancel disabled={pending}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</AlertDialogCancel></AlertDialogFooter>{state.error&&<p role="alert" className="error-message">{actionFeedback(state.error,locale)}</p>}</AlertDialogContent></AlertDialog></>;
}
export function AnnouncementList({items,org,slug,locale="ar",filter:controlledFilter,onFilterChange,serverPaged=false}:{slug?:string;serverPaged?:boolean;items:ManagedAnnouncement[];org:string;locale?:Locale;filter?:string;onFilterChange?:(value:string)=>void}){
 const {params,change}=useListQuery(),en=locale==="en",c=createTranslator(locale);
 const filter=controlledFilter??params.get("announcementStatus")??"all",q=params.get("announcementSearch")??"",sort=params.get("announcementSort")??"desc";
 const setFilter=(value:string)=>{if(onFilterChange)onFilterChange(value);else change({announcementStatus:value,announcementPage:null});};
 const matches=(item:ManagedAnnouncement,key:string)=>key==="archived"?Boolean(item.archived):!item.archived&&(key==="all"||key==="published"&&item.published||key==="draft"&&!item.published||key==="pinned"&&item.pinned);
 const projection=useOptimisticRows(items,item=>item.id);
 const visible=projection.items.filter(item=>matches(item,filter)&&arabicSearchKey(`${item.title} ${item.body}`).includes(arabicSearchKey(q))).sort((a,b)=>(Date.parse(a.publishedAt??a.createdAt??"")-Date.parse(b.publishedAt??b.createdAt??""))*(sort==="asc"?1:-1));
 const page=Math.max(0,Math.min(10000,Number(params.get("announcementPage"))||0)),pageRows=serverPaged?visible:visible.slice(page*25,page*25+26);
 const href=(item:ManagedAnnouncement)=>`/organizations/${slug??org}?section=announcements#announcement-${item.id}`;
 const actions=(item:ManagedAnnouncement)=><div className="flex shrink-0 items-center gap-1"><RowAction href={href(item)} label={c("عرض الإعلان","View announcement")} disabled={!item.published||item.archived} hint={c("الإعلان غير منشور في الصفحة العامة","This announcement is not published on the public page")}><Eye/></RowAction>{item.archived?<RowAction label={c("تعديل الإعلان","Edit announcement")} hint={c("الإعلان المؤرشف للعرض فقط.","Archived announcements are read-only.")} disabled><Pencil/></RowAction>:<AnnouncementDialog organizationId={org} announcement={item} locale={locale} triggerLabel={c("تعديل الإعلان","Edit announcement")}/>}<AnnouncementDecision item={item} org={org} kind="pin" locale={locale} optimistic={kind=>projection.change(item.id,row=>kind==="delete"?null:kind==="archive"?{...row,archived:true}:{...row,pinned:!row.pinned})}/><AnnouncementDecision item={item} org={org} kind="archive" locale={locale} optimistic={kind=>projection.change(item.id,row=>kind==="delete"?null:{...row,archived:true})}/><AnnouncementDecision item={item} org={org} kind="delete" locale={locale} optimistic={()=>projection.change(item.id,()=>null)}/></div>;
 return <section className="flex min-w-0 flex-col gap-4" aria-label={c("إعلانات الجهة","Organization announcements")}><SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" aria-label={c("بحث الإعلانات","Search announcements")} placeholder={c("ابحث عن إعلان","Search announcements")} value={q} onChange={e=>change({announcementSearch:e.target.value,announcementPage:null},true)}/></InputGroup>}><FilterTabs value={filter} onValueChange={setFilter} ariaLabel={c("حالة الإعلان","Announcement status")} dir={en?"ltr":"rtl"} options={[["all",c("الكل","All")],["published",c("منشورة","Published")],["draft",c("مسودة","Draft")],["archived",c("مؤرشفة","Archived")]].map(([value,label])=>({value,label,count:items.filter(item=>matches(item,value)).length}))}/><AnnouncementDialog organizationId={org} locale={locale}/></SearchFilterToolbar>
 <ItemTable canOpen={item=>item.published&&!item.archived} pagination={{page,more:pageRows.length>25,onChange:value=>change({announcementPage:String(value)})}} items={pageRows.slice(0,25)} href={href} label={c("عرض الإعلان","View announcement")} empty={<ListEmpty filtered={Boolean(q||filter!=="all")} clear={()=>{setFilter("all");change({announcementSearch:null});}} icon={Megaphone} title={c("لا توجد إعلانات بعد","No announcements yet")} description={c("أنشئ أول إعلان للجهة.","Create the organization's first announcement.")}/>} columns={[
 {id:"name",label:c("الإعلان","Announcement"),render:item=><div className="flex min-w-0 items-center gap-3"><ListThumbnail src={item.imageAssetId?`/files/${item.imageAssetId}/preview?thumbnail=1`:null} icon={Megaphone}/><div className="min-w-0 flex-1"><h3><ItemTitle><ContentText value={item.title}/></ItemTitle></h3><p className="line-clamp-2 text-sm text-muted-foreground"><ContentText value={item.body}/></p>{item.pinned&&<Badge variant="outline">{c("مثبّت","Pinned")}</Badge>}</div></div>},
 {id:"date",label:<Button variant="ghost" size="sm" onClick={()=>change({announcementSort:sort==="asc"?"desc":"asc"})}>{c("التاريخ","Date")}</Button>,className:"w-40",render:item=><time>{formatRiyadhDate(item.publishedAt??item.createdAt??"",locale)}</time>},
 {id:"status",label:c("الحالة","Status"),className:"w-28",render:item=><OrganizationStatusBadge status={item.archived?"archived":item.published?"published":"draft"}>{item.archived?c("مؤرشف","Archived"):item.published?c("منشور","Published"):c("مسودة","Draft")}</OrganizationStatusBadge>},
 {id:"actions",label:c("الإجراءات","Actions"),className:"w-40",render:actions}
 ]}/>


 </section>;
}
