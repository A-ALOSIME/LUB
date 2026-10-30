"use client";

import {createContext,useContext,useState,type ReactNode} from "react";
import {Eye} from "lucide-react";
import {Card,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {RowAction} from "@/components/row-action";
import {t} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {TaskPanelAction} from "./task-panel-action";

const OpenTaskContext=createContext<(()=>void)|null>(null);
export function TaskCardEye({locale}:{locale:Locale}){
 const open=useContext(OpenTaskContext);
 return <RowAction className="task-card-actions pointer-events-auto relative" label={t(locale,"عرض التفاصيل","View details")} onClick={()=>open?.()}><Eye/></RowAction>;
}
export function TaskCardSurface({task,title,locale,children,actions,media}:{task:string;title:string;locale:Locale;children:ReactNode;actions:ReactNode;media?:ReactNode}){
 const [open,setOpen]=useState(false);
 return <>
  <Card className="relative overflow-hidden py-0">
   <Button type="button" variant="ghost" className="absolute inset-0 size-full rounded-[inherit]" aria-label={t(locale,`عرض المهمة: ${title}`,`View task: ${title}`)} onClick={()=>setOpen(true)}/>
   <CardContent className="pointer-events-none relative flex items-stretch gap-0 p-0">
    {media&&<div className="relative w-20 shrink-0 self-stretch">{media}</div>}
    <OpenTaskContext.Provider value={()=>setOpen(true)}><div className="min-w-0 flex-1 p-4">{children}</div></OpenTaskContext.Provider>
    <div className="task-card-actions pointer-events-auto relative flex shrink-0 flex-col justify-center gap-1 py-3 pe-3 sm:flex-row sm:items-center sm:gap-2">
     {actions}
    </div>
   </CardContent>
  </Card>
  <TaskPanelAction task={task} title={title} locale={locale} open={open} onOpenChange={setOpen} hideTrigger/>
 </>;
}
