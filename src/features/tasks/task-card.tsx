"use client";

import {useState,type ReactNode} from "react";
import {Eye} from "lucide-react";
import {Card,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {RowAction} from "@/components/row-action";
import {t} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {TaskPanelAction} from "./task-panel-action";

export function TaskCardSurface({task,title,locale,children,actions}:{task:string;title:string;locale:Locale;children:ReactNode;actions:ReactNode}){
 const [open,setOpen]=useState(false);
 return <>
  <Card className="relative">
   <Button type="button" variant="ghost" className="absolute inset-0 size-full rounded-[inherit]" aria-label={t(locale,`عرض المهمة: ${title}`,`View task: ${title}`)} onClick={()=>setOpen(true)}/>
   <CardContent className="pointer-events-none relative flex items-center gap-4">
    {children}
    <div className="task-card-actions pointer-events-auto relative flex shrink-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
     <RowAction label={t(locale,"عرض التفاصيل","View details")} onClick={()=>setOpen(true)}><Eye/></RowAction>
     {actions}
    </div>
   </CardContent>
  </Card>
  <TaskPanelAction task={task} title={title} locale={locale} open={open} onOpenChange={setOpen} hideTrigger/>
 </>;
}
