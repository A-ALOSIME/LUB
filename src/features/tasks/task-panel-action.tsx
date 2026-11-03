"use client";
import {actionFeedback} from "@/lib/action-feedback";

import {t as translateUi} from "@/lib/i18n";
import {useEffect,useRef,useState} from "react";
import {Eye,Pencil,Upload} from "lucide-react";
import {ManagementActionProvider,ManagementActionSheet} from "@/components/management-action-sheet";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import type {TaskPanelQuery} from "./task-detail";
const TaskDetailView=dynamic(()=>import("./task-detail").then(module=>module.TaskDetailView));
const TaskEditorForm=dynamic(()=>import("./task-composer").then(module=>module.TaskEditorForm));
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {taskPanelQuery,initialTaskPanelQuery} from "./panel-query";
import type {Locale} from "@/lib/preferences";



export function TaskPanelAction({task,title,locale="ar",submission=false,edit=false,open:controlledOpen,onOpenChange,hideTrigger=false}:{task:string;title:string;locale?:Locale;submission?:boolean;edit?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean}){
  const en=locale==="en",label=edit?(translateUi((en) ? "en" : "ar", "تعديل المهمة", "Edit task")):submission?(translateUi((en) ? "en" : "ar", "تسليم العمل", "Submit work")):(translateUi((en) ? "en" : "ar", "عرض التفاصيل", "View details"));
  const [localOpen,setLocalOpen]=useState(false);
  const open=controlledOpen??localOpen,setOpen=onOpenChange??setLocalOpen;
  const actor=useQueryActor(),client=useQueryClient(),[query,setQuery]=useState<TaskPanelQuery>(initialTaskPanelQuery),content=useRef<HTMLDivElement>(null);
  const options=taskPanelQuery(actor,task,query),response=useQuery({...options,enabled:open}),result=response.data,pending=response.isPending;
  const load=async(next:TaskPanelQuery,force=false)=>{setQuery(next);if(force){await client.invalidateQueries({queryKey:["task-panel",actor,task]});return;}await client.fetchQuery(taskPanelQuery(actor,task,next));};
  useEffect(()=>{
    if(open&&submission&&result?.detail)content.current?.querySelector("#submissions")?.scrollIntoView({block:"start"});
  },[open,submission,result]);
  return <ManagementActionSheet rowAction label={label} title={edit?label:title} locale={locale} icon={edit?<Pencil/>:submission?<Upload/>:<Eye/>} presentation={edit?"dialog":"sheet"} width="wide" hideTrigger={hideTrigger} open={open} onOpenChange={setOpen}>
    <div ref={content} className="min-w-0">
      {pending&&!result&&<div role="status" aria-label={translateUi((en) ? "en" : "ar", "جارٍ تحميل المهمة", "Loading task")} className="space-y-4"><Skeleton className="h-8 w-2/3"/><Skeleton className="h-40 w-full"/><Skeleton className="h-28 w-full"/></div>}
      {(result?.error||response.isError)&&<Alert variant="destructive"><AlertDescription>{actionFeedback(result?.error??translateUi(locale,"تعذّر عرض المهمة. حاول مجددًا.","Unable to load this task. Please try again."),locale)}</AlertDescription><Button variant="outline" onClick={()=>load(query,true)}>{translateUi((en) ? "en" : "ar", "إعادة المحاولة", "Retry")}</Button></Alert>}
      {result?.detail&&(edit?(result.detail.canManage&&result.workspace?<TaskEditorForm org={result.detail.task.organization_id} task={result.detail.task} workspace={result.workspace} locale={locale}/>:<Alert><AlertDescription>{translateUi((en) ? "en" : "ar", "لا تملك صلاحية تعديل هذه المهمة.", "You cannot edit this task.")}</AlertDescription></Alert>):<ManagementActionProvider locale={locale} close={()=>setOpen(false)} inlineForms refresh={()=>load(query,true)}><TaskDetailView detail={result.detail} workspace={result.workspace} {...query} locale={locale} onNavigate={changes=>load({...query,...changes})}/></ManagementActionProvider>)}
    </div>
  </ManagementActionSheet>;
}
