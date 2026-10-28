"use client";

import {useEffect,useRef,useState,useTransition} from "react";
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

export function TaskPanelAction({task,title,locale="ar",submission=false,edit=false}:{task:string;title:string;locale?:Locale;submission?:boolean;edit?:boolean}){
  const en=locale==="en",label=edit?(en?"Edit task":"تعديل المهمة"):submission?(en?"Submit work":"تسليم العمل"):(en?"View details":"عرض التفاصيل");
  const [open,setOpen]=useState(false),[pending,startTransition]=useTransition();
  const [result,setResult]=useState<Awaited<ReturnType<typeof loadTaskPanel>>|null>(null);
  const [query,setQuery]=useState(initialQuery),sequence=useRef(0),content=useRef<HTMLDivElement>(null);
  function load(next:TaskPanelQuery){
    const current=++sequence.current;
    setQuery(next);setResult(null);
    startTransition(async()=>{
      try{const value=await loadTaskPanel(task,next);if(current===sequence.current)setResult(value);}
      catch{if(current===sequence.current)setResult({error:en?"Unable to load this task. Please try again.":"تعذّر عرض المهمة. حاول مرة ثانية."});}
    });
  }
  useEffect(()=>{
    if(open&&submission&&result?.detail)content.current?.querySelector("#submissions")?.scrollIntoView({block:"start"});
  },[open,submission,result]);
  return <ManagementActionSheet rowAction label={label} title={edit?label:title} locale={locale} icon={edit?<Pencil/>:submission?<Upload/>:<Eye/>} presentation={edit?"dialog":"sheet"} width="wide" open={open} onOpenChange={value=>{
    setOpen(value);
    if(value)load(initialQuery);else{sequence.current++;setResult(null);}
  }}>
    <div ref={content} className="min-w-0">
      {pending&&!result&&<div role="status" aria-label={en?"Loading task":"جارٍ تحميل المهمة"} className="space-y-4"><Skeleton className="h-8 w-2/3"/><Skeleton className="h-40 w-full"/><Skeleton className="h-28 w-full"/></div>}
      {result?.error&&<Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription><Button variant="outline" onClick={()=>load(query)}>{en?"Retry":"إعادة المحاولة"}</Button></Alert>}
      {result?.detail&&(edit?(result.detail.canManage&&result.workspace?<TaskEditorForm org={result.detail.task.organization_id} task={result.detail.task} workspace={result.workspace} locale={locale}/>:<Alert><AlertDescription>{en?"You cannot edit this task.":"لا تملك صلاحية تعديل هذه المهمة."}</AlertDescription></Alert>):<ManagementActionProvider locale={locale} close={()=>setOpen(false)} inlineForms><TaskDetailView detail={result.detail} workspace={result.workspace} {...query} locale={locale} onNavigate={changes=>load({...query,...changes})}/></ManagementActionProvider>)}
    </div>
  </ManagementActionSheet>;
}
