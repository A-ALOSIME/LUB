"use client";
import {useEffect,useRef,useState} from "react";
import dynamic from "next/dynamic";
import {Eye,Pencil,Upload} from "lucide-react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {ManagementActionProvider,ManagementActionSheet} from "@/components/management-action-sheet";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {useQueryActor} from "@/components/private-query-provider";
import {initialTaskPanelQuery,taskPanelQuery} from "./panel-query";
import type {TaskPanelQuery} from "./task-detail";
const TaskDetailView=dynamic(()=>import("./task-detail").then(module=>module.TaskDetailView));
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
const TaskEditorForm=dynamic(()=>import("./task-composer").then(module=>module.TaskEditorForm));
type Props={task:string;title:string;locale?:Locale;submission?:boolean;edit?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean;disabled?:boolean;hint?:string;management?:boolean};
export function TaskPanelAction(props:Props){return props.edit?<TaskEditorDialog {...props}/>:<TaskDetailsSheet {...props}/>;}
function TaskDetailsSheet({task,title,locale="ar",submission=false,management=false,open:controlled,onOpenChange,hideTrigger,disabled,hint}:Props){
 const [local,setLocal]=useState(false),open=controlled??local,setOpen=onOpenChange??setLocal,actor=useQueryActor(),client=useQueryClient(),t=createTranslator(locale),content=useRef<HTMLDivElement>(null);
 const [section,setSection]=useState("task"),[query,setQuery]=useState<TaskPanelQuery>({...initialTaskPanelQuery,purpose:management?"view":"student"});
 const response=useQuery({...taskPanelQuery(actor,task,query),enabled:open}),result=response.data;
 useEffect(()=>{if(!open)return;const refresh=()=>{void client.invalidateQueries({queryKey:["task-panel",actor,task]});};window.addEventListener("activity-changed",refresh);return()=>window.removeEventListener("activity-changed",refresh);},[actor,client,open,task]);
 useEffect(()=>{if(open&&submission&&result?.detail)content.current?.querySelector("#submissions")?.scrollIntoView({block:"start"});},[open,result,submission]);
 return <ManagementActionSheet rowAction label={submission?t("تسليم العمل","Submit work"):t("عرض التفاصيل","View details")} title={title} locale={locale} icon={submission?<Upload/>:<Eye/>} presentation="sheet" width="wide" hideTrigger={hideTrigger} open={open} onOpenChange={setOpen} disabled={disabled} hint={hint}>
  <div ref={content} className="min-w-0">
   {response.isPending&&<div aria-busy="true" className="flex flex-col gap-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-32 w-full"/></div>}
   {(response.isError||result?.error)&&<Alert><AlertDescription>{t("تعذّر تحميل المهمة. حاول مجددًا.","The task could not be loaded. Try again.")}</AlertDescription><Button variant="outline" onClick={()=>void response.refetch()}>{t("إعادة المحاولة","Retry")}</Button></Alert>}
   {result?.detail&&<ManagementActionProvider locale={locale} close={()=>setOpen(false)} inlineForms><TaskDetailView detail={result.detail} {...query} locale={locale} section={section} onSectionChange={setSection} onNavigate={next=>{setQuery(current=>({...current,...next}));if("participant" in next)setSection("submissions");}} embedded/></ManagementActionProvider>}
  </div>
 </ManagementActionSheet>;
}
function TaskEditorDialog({task,locale="ar",open:controlled,onOpenChange,hideTrigger}:Props){
 const [local,setLocal]=useState(false),open=controlled??local,setOpen=onOpenChange??setLocal,actor=useQueryActor(),client=useQueryClient(),t=createTranslator(locale);
 const response=useQuery({...taskPanelQuery(actor,task),enabled:open}),result=response.data;
 return <ManagementActionSheet rowAction label={t("تعديل المهمة","Edit task")} title={t("تعديل المهمة","Edit task")} locale={locale} icon={<Pencil/>} width="wide" hideTrigger={hideTrigger} open={open} onOpenChange={setOpen} mobileBottomSheet>
  {response.isPending&&<div aria-busy="true" className="flex flex-col gap-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-32 w-full"/></div>}
  {(response.isError||result?.error)&&<Alert><AlertDescription>{t("تعذّر تحميل المهمة. حاول مجددًا.","The task could not be loaded. Try again.")}</AlertDescription><Button variant="outline" onClick={()=>void response.refetch()}>{t("إعادة المحاولة","Retry")}</Button></Alert>}
  {result?.detail&&(result.detail.canManage&&result.workspace?<TaskEditorForm org={result.detail.task.organization_id} task={result.detail.task} workspace={result.workspace} locale={locale} onSaved={()=>{void client.invalidateQueries({queryKey:["task-panel",actor,task]});}}/>:<Alert><AlertDescription>{t("لا تملك صلاحية تعديل هذه المهمة.","You cannot edit this task.")}</AlertDescription></Alert>)}
 </ManagementActionSheet>;
}
