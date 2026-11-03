"use client";
import {useState} from "react";
import dynamic from "next/dynamic";
import {Eye,Pencil,Upload} from "lucide-react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {RowAction} from "@/components/row-action";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {useQueryActor} from "@/components/private-query-provider";
import {taskPanelQuery} from "./panel-query";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
const TaskEditorForm=dynamic(()=>import("./task-composer").then(module=>module.TaskEditorForm));
type Props={task:string;title:string;locale?:Locale;submission?:boolean;edit?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean;disabled?:boolean;hint?:string};
export function TaskPanelAction(props:Props){const locale=props.locale??"ar",t=createTranslator(locale);return props.edit?<TaskEditorDialog {...props} locale={locale}/>:<RowAction disabled={props.disabled} hint={props.hint} href={`/tasks/${props.task}${props.submission?"#submissions":""}`} label={props.submission?t("تسليم العمل","Submit work"):t("عرض التفاصيل","View details")}>{props.submission?<Upload/>:<Eye/>}</RowAction>;}
function TaskEditorDialog({task,locale="ar",open:controlled,onOpenChange,hideTrigger}:Props){
 const [local,setLocal]=useState(false),open=controlled??local,setOpen=onOpenChange??setLocal,actor=useQueryActor(),client=useQueryClient(),t=createTranslator(locale);
 const response=useQuery({...taskPanelQuery(actor,task),enabled:open}),result=response.data;
 return <ManagementActionSheet rowAction label={t("تعديل المهمة","Edit task")} title={t("تعديل المهمة","Edit task")} locale={locale} icon={<Pencil/>} width="wide" hideTrigger={hideTrigger} open={open} onOpenChange={setOpen} mobileBottomSheet>
  {response.isPending&&<div aria-busy="true" className="flex flex-col gap-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-32 w-full"/></div>}
  {(response.isError||result?.error)&&<Alert><AlertDescription>{t("تعذّر تحميل المهمة. حاول مجددًا.","The task could not be loaded. Try again.")}</AlertDescription><Button variant="outline" onClick={()=>void response.refetch()}>{t("إعادة المحاولة","Retry")}</Button></Alert>}
  {result?.detail&&(result.detail.canManage&&result.workspace?<TaskEditorForm org={result.detail.task.organization_id} task={result.detail.task} workspace={result.workspace} locale={locale} onSaved={()=>{void client.invalidateQueries({queryKey:["task-panel",actor,task]});}}/>:<Alert><AlertDescription>{t("لا تملك صلاحية تعديل هذه المهمة.","You cannot edit this task.")}</AlertDescription></Alert>)}
 </ManagementActionSheet>;
}
