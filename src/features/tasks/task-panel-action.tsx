"use client";
import {actionFeedback} from "@/lib/action-feedback";

import {t as translateUi} from "@/lib/i18n";
import {useCallback,useEffect,useRef,useState,useTransition} from "react";
import {Eye,Pencil,Upload} from "lucide-react";
import {ManagementActionProvider,ManagementActionSheet} from "@/components/management-action-sheet";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {TaskDetailView,type TaskPanelQuery} from "./task-detail";
import {TaskEditorForm} from "./task-composer";
import {loadTaskPanel} from "./task-panel-actions";
import type {Locale} from "@/lib/preferences";

const initialQuery:TaskPanelQuery={page:0,teamPage:0,eventPage:0,participant:null};

export function TaskPanelAction({task,title,locale="ar",submission=false,edit=false,open:controlledOpen,onOpenChange,hideTrigger=false}:{task:string;title:string;locale?:Locale;submission?:boolean;edit?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean}){
  const en=locale==="en",label=edit?(translateUi((en) ? "en" : "ar", "تعديل المهمة", "Edit task")):submission?(translateUi((en) ? "en" : "ar", "تسليم العمل", "Submit work")):(translateUi((en) ? "en" : "ar", "عرض التفاصيل", "View details"));
  const [localOpen,setLocalOpen]=useState(false),[pending,startTransition]=useTransition();
  const open=controlledOpen??localOpen,setOpen=onOpenChange??setLocalOpen;
  const [result,setResult]=useState<Awaited<ReturnType<typeof loadTaskPanel>>|null>(null);
  const [query,setQuery]=useState(initialQuery),sequence=useRef(0),content=useRef<HTMLDivElement>(null);
  const load=useCallback((next:TaskPanelQuery,quiet=false)=>{
    const current=++sequence.current;
    setQuery(next);if(!quiet)setResult(null);
    return new Promise<void>(resolve=>{startTransition(async()=>{
      try{const value=await loadTaskPanel(task,next);if(current===sequence.current)setResult(value);}
      catch{if(current===sequence.current&&!quiet)setResult({error:translateUi(locale, "تعذّر عرض المهمة. حاول مرة ثانية.", "Unable to load this task. Please try again.")});}
      finally{resolve();}
    });});
  },[task,locale,startTransition]);
  const invalidate=useCallback(()=>{sequence.current++;},[]);
  useEffect(()=>{
    if(!open){invalidate();return;}
    let cancelled=false;
    // Start loading after the mounted panel has committed; close cancels stale results.
    void Promise.resolve().then(()=>{if(!cancelled)load(initialQuery);});
    return()=>{cancelled=true;invalidate();};
  },[open,load,invalidate]);
  useEffect(()=>{
    if(open&&submission&&result?.detail)content.current?.querySelector("#submissions")?.scrollIntoView({block:"start"});
  },[open,submission,result]);
  return <ManagementActionSheet rowAction label={label} title={edit?label:title} locale={locale} icon={edit?<Pencil/>:submission?<Upload/>:<Eye/>} presentation={edit?"dialog":"sheet"} width="wide" hideTrigger={hideTrigger} open={open} onOpenChange={setOpen}>
    <div ref={content} className="min-w-0">
      {pending&&!result&&<div role="status" aria-label={translateUi((en) ? "en" : "ar", "جارٍ تحميل المهمة", "Loading task")} className="space-y-4"><Skeleton className="h-8 w-2/3"/><Skeleton className="h-40 w-full"/><Skeleton className="h-28 w-full"/></div>}
      {result?.error&&<Alert variant="destructive"><AlertDescription>{actionFeedback(result.error,locale)}</AlertDescription><Button variant="outline" onClick={()=>load(query)}>{translateUi((en) ? "en" : "ar", "إعادة المحاولة", "Retry")}</Button></Alert>}
      {result?.detail&&(edit?(result.detail.canManage&&result.workspace?<TaskEditorForm org={result.detail.task.organization_id} task={result.detail.task} workspace={result.workspace} locale={locale}/>:<Alert><AlertDescription>{translateUi((en) ? "en" : "ar", "لا تملك صلاحية تعديل هذه المهمة.", "You cannot edit this task.")}</AlertDescription></Alert>):<ManagementActionProvider locale={locale} close={()=>setOpen(false)} inlineForms refresh={()=>load(query,true)}><TaskDetailView detail={result.detail} workspace={result.workspace} {...query} locale={locale} onNavigate={changes=>load({...query,...changes})}/></ManagementActionProvider>)}
    </div>
  </ManagementActionSheet>;
}
