"use client";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {Link2} from "lucide-react";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {RowAction} from "@/components/row-action";
import {FormField} from "@/components/form-field";
import {NativeSelect} from "@/components/ui/native-select";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {useQueryActor} from "@/components/private-query-provider";
import {ContentText} from "@/components/content-text";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {taskPanelQuery,initialTaskPanelQuery} from "./panel-query";
import {TaskForm} from "./task-form";
export function TaskEventLinkAction({task,enabled,locale}:{task:string;enabled:boolean;locale:Locale}){
 const [open,setOpen]=useState(false),actor=useQueryActor(),client=useQueryClient(),router=useRouter(),t=createTranslator(locale),result=useQuery({...taskPanelQuery(actor,task,{...initialTaskPanelQuery,purpose:"link"}),enabled:open}),detail=result.data?.detail;
 return <><RowAction label={t("ربط بفعالية","Link to event")} disabled={!enabled} hint={t("يتطلب صلاحية إدارة مهمة مفتوحة أو مسودة.","Requires permission to manage an open task or draft.")} onClick={()=>setOpen(true)}><Link2/></RowAction><ManagementActionSheet label="" title={t("ربط بفعالية","Link to event")} locale={locale} open={open} onOpenChange={setOpen} hideTrigger mobileBottomSheet>
 {result.isPending?<Skeleton className="h-10 w-full"/>:detail?.canManage?<TaskForm operation="link-event" fields={{task,revision:String(detail.task.revision)}} label={t("حفظ","Save")} locale={locale} onSuccess={()=>{void client.invalidateQueries({queryKey:["task-panel",actor,task]});router.refresh();}}><FormField label={t("الفعالية","Event")}><NativeSelect name="event" defaultValue={detail.task.event_id??""}><option value="">{t("بدون فعالية","No event")}</option>{detail.task.event_id&&!detail.eventChoices.some(event=>event.id===detail.task.event_id)&&<option value={detail.task.event_id}>{detail.linkedEvent?.title??t("الفعالية الحالية","Current event")}</option>}{detail.eventChoices.map(event=><option key={event.id} value={event.id}><ContentText value={event.title}/></option>)}</NativeSelect></FormField></TaskForm>:<Alert><AlertDescription>{t("تعذّر تحميل الخيارات أو لا تملك صلاحية تعديل المهمة.","Options could not be loaded or you cannot edit this task.")}</AlertDescription><Button variant="outline" onClick={()=>void result.refetch()}>{t("إعادة المحاولة","Retry")}</Button></Alert>}
 </ManagementActionSheet></>;
}
