"use client";
import {useRef,useState,type ReactNode} from "react";
import {Check,Copy,Users} from "lucide-react";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import {Card,CardHeader,CardTitle,CardContent,CardAction} from "@/components/ui/card";
import {Avatar,AvatarImage,AvatarFallback} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Skeleton} from "@/components/ui/skeleton";
import {NativeSelect} from "@/components/ui/native-select";
import {toast} from "@/components/ui/toast";
import {academicLevel,majorLabel,formatHours} from "@/lib/display";
import {formatRiyadhDate,formatRiyadhDateTime} from "@/lib/datetime";
import {splitPhone} from "@/lib/phone";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import type {MemberRecord} from "./member-types";

export const memberRoleNames:Record<string,[string,string]>={OL:["قائد الجهة","Organization leader"],OD:["نائب القائد","Deputy leader"],CL:["قائد لجنة","Committee leader"],CD:["نائب لجنة","Committee deputy"]};
export function CopyMemberValue({value,label,locale,section=false}:{value:string;label:string;locale:Locale;section?:boolean}){
 const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false),c=createTranslator(locale);
 async function copy(){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([navigator.clipboard.writeText(value),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Clipboard unavailable")),2000);})]);setCopied(true);setFailed(false);toast.add({title:c("تم النسخ","Copied"),type:"success",timeout:2000});setTimeout(()=>setCopied(false),2000);}catch{setFailed(true);}finally{clearTimeout(timer);}}
 return <><Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={label} className={section?"shrink-0":"shrink-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"} onClick={copy}/>}>{copied?<Check/>:<Copy/>}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>{failed&&<span role="alert" className="basis-full text-sm text-muted-foreground">{c("تعذّر النسخ. حدّد النص وانسخه يدويًا.","Copy unavailable. Select the text and copy it manually.")}</span>}</>;
}
type Value={label:string;value:string|null|undefined;numeric?:boolean;emphasis?:boolean};
function DetailCard({title,values,children,locale,tools}:{title:string;values:Value[];children?:ReactNode;locale:Locale;tools?:ReactNode}){
 const c=createTranslator(locale),missing=c("غير مسجل","Not recorded");
 return <Card><CardHeader><CardTitle>{title}</CardTitle><CardAction><CopyMemberValue section value={values.map(x=>`${x.label}: ${x.value||missing}`).join("\n")} label={c("نسخ القسم كاملاً","Copy section")} locale={locale}/></CardAction></CardHeader><CardContent className="flex flex-col gap-4 select-text">{tools}{children??<dl className="flex flex-col gap-4">{values.map((field,i)=><div key={i} className="group flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><dt className="text-sm text-muted-foreground">{field.label}</dt><dd className={field.emphasis?"mt-1 break-words text-2xl font-semibold":"mt-1 break-words"}><bdi dir={field.numeric?"ltr":"auto"}>{field.value||missing}</bdi></dd></div>{field.value&&<CopyMemberValue value={field.value} label={`${c("نسخ","Copy")} ${field.label}`} locale={locale}/>}</div>)}</dl>}</CardContent></Card>;
}
export function MemberDetailSheet({open,onOpenChange,record,error,locale}:{open:boolean;onOpenChange:(open:boolean)=>void;record:MemberRecord|null;error:boolean;locale:Locale}){
 const titleRef=useRef<HTMLHeadingElement>(null);
 const c=createTranslator(locale),en=locale==="en",[phoneFormat,setPhoneFormat]=useState("international");
 const status=(value:string)=>value==="Active"?c("نشطة","Active"):value==="Ended"?c("منتهية","Ended"):c("غير نشطة","Inactive");
 const roles=record?.roles.map(x=>[memberRoleNames[x.code]?.[en?1:0]??x.code,x.committee].filter(Boolean).join(" · "))??[];
 const parts=record?.phone?splitPhone(record.phone):null;
 const phone=phoneFormat==="local"&&parts?(parts.code==="966"?`0${parts.number.replace(/^0+/,"")}`:parts.number):record?.phone;
 const events=record?.events.map(event=>({label:event.code==="Joined"?c("انضم إلى الجهة","Joined the organization"):event.code==="Rejoined"?c("عاد إلى الجهة","Rejoined the organization"):event.code==="Ended"?c("انتهت العضوية","Membership ended"):c("تغيّرت الحالة","Status changed"),value:`${event.imported?formatRiyadhDate(event.at,locale):formatRiyadhDateTime(event.at,locale)} · ${event.actor??c("المنفّذ غير مسجل","Actor not recorded")}`}))??[];
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent initialFocus={()=>titleRef.current} side="right" dir={en?"ltr":"rtl"} className="w-screen max-w-none sm:w-[36rem] sm:max-w-[90vw]"><SheetHeader><SheetTitle ref={titleRef} tabIndex={-1}>{record?.name??c("تفاصيل العضو","Member details")}</SheetTitle><SheetDescription>{record?.organization.name??c("بيانات العضو في الجهة الحالية فقط","Member information for the current organization only")}</SheetDescription></SheetHeader>
 {error?<Alert><AlertDescription>{c("تعذّر تحميل بيانات العضو أو لا تملك صلاحية عرضها.","Member details could not be loaded or you do not have access.")}</AlertDescription></Alert>:!record?<div className="flex flex-col gap-4" aria-busy="true">{[1,2,3].map(x=><Skeleton key={x} className="h-40 w-full"/>)}</div>:<div className="flex flex-col gap-5 pb-8">
 <DetailCard title={c("الهوية","Identity")} locale={locale} values={[{label:c("الاسم","Name"),value:record.name},{label:c("التخصص","Major"),value:majorLabel(record.major,locale)},{label:c("المستوى","Level"),value:academicLevel(record.level,locale)},{label:c("الحالة","Status"),value:status(record.status)}]}><div className="flex items-center gap-4"><Avatar className="size-16">{record.avatar&&<AvatarImage src={record.avatar} alt={record.name}/>}<AvatarFallback>{record.name.trim().slice(0,1)}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group"><p className="font-semibold break-words">{record.name}</p><p className="text-sm text-muted-foreground">{majorLabel(record.major,locale)} · {academicLevel(record.level,locale)}</p><Badge variant="secondary">{status(record.status)}</Badge></div><CopyMemberValue value={record.name} label={c("نسخ الاسم","Copy name")} locale={locale}/></div></DetailCard>
 <DetailCard title={c("البيانات الأكاديمية","Academic details")} locale={locale} values={[{label:c("الرقم الجامعي","University ID"),value:record.universityId,numeric:true},{label:c("رقم الهوية أو الإقامة","National or residency ID"),value:record.nationalId,numeric:true},{label:c("التخصص","Major"),value:majorLabel(record.major,locale)},{label:c("المستوى الدراسي","Academic level"),value:academicLevel(record.level,locale)}]}/>
 <DetailCard title={c("التواصل","Contact")} tools={<NativeSelect aria-label={c("صيغة رقم الجوال","Phone format")} value={phoneFormat} onChange={event=>setPhoneFormat(event.target.value)}><option value="international">{c("دولي","International")}</option><option value="local">{c("محلي","Local")}</option></NativeSelect>} locale={locale} values={[{label:c("البريد الجامعي","University email"),value:record.email,numeric:true},{label:c("رقم الجوال","Phone"),value:phone,numeric:true}]}/>
 <DetailCard title={c("المشاركة","Participation")} locale={locale} values={[{label:c("الساعات المعتمدة","Approved hours"),value:formatHours(record.hours,locale),emphasis:true},{label:c("آخر انضمام","Latest joined date"),value:formatRiyadhDate(record.startDate,locale)},{label:c("الدور","Role"),value:roles.join("\n")||c("عضو","Member")}]}/>
 <DetailCard title={c("الجهة واللجان","Organization and committees")} locale={locale} values={[{label:c("الجهة","Organization"),value:record.organization.name},...record.roles.map((role,i)=>({label:`${c("الدور","Role")} ${i+1}`,value:`${memberRoleNames[role.code]?.[en?1:0]??role.code}${role.committee?` · ${role.committee}`:""} · ${formatRiyadhDate(role.startDate,locale)}${role.endDate?` – ${formatRiyadhDate(role.endDate,locale)}`:""}`})),...record.committees.map((committee,i)=>({label:`${c("اللجنة","Committee")} ${i+1}`,value:`${committee.name} · ${status(committee.status)} · ${formatRiyadhDate(committee.startDate,locale)}`}))]}/>
 <DetailCard title={c("سجل العضوية","Membership history")} locale={locale} values={events}><ol className="flex flex-col gap-5 border-s ps-4">{events.map((event,i)=><li className="group relative flex flex-wrap items-start gap-2" key={i}><Users className="size-4 shrink-0"/><div className="min-w-0 flex-1"><p className="font-medium">{event.label}</p><p className="text-sm text-muted-foreground">{event.value}</p></div><CopyMemberValue value={`${event.label}: ${event.value}`} label={c("نسخ الحدث","Copy event")} locale={locale}/></li>)}</ol></DetailCard>
 </div>}</SheetContent></Sheet>;
}
