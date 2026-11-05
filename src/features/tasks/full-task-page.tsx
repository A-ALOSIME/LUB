"use client";
import {useEffect,useMemo} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {TaskDetailView} from "./task-detail";
import {initialTaskPanelQuery,taskPanelQuery} from "./panel-query";
import type {TaskDetail} from "./repository";
import type {Locale} from "@/lib/preferences";

/** Shares the exact actor-scoped cache primed by list hover and retained Sheets. */
export function FullTaskPage({detail,page,teamPage,participant,locale}:{detail:TaskDetail;page:number;teamPage:number;participant:string|null;locale:Locale}){
 const actor=useQueryActor(),client=useQueryClient(),options=useMemo(()=>taskPanelQuery(actor,detail.task.id,{...initialTaskPanelQuery,page,teamPage,participant,purpose:detail.canManage?"view":"student"}),[actor,detail.task.id,detail.canManage,page,teamPage,participant]);
 const response=useQuery({...options,initialData:{detail}});
 useEffect(()=>{const refresh=()=>{void client.invalidateQueries({queryKey:["task-panel",actor,detail.task.id]});};window.addEventListener("activity-changed",refresh);return()=>window.removeEventListener("activity-changed",refresh);},[actor,client,detail.task.id]);
 useEffect(()=>{client.setQueryData(options.queryKey,current=>!current?.detail||Date.parse(detail.asOf??"")>Date.parse(current.detail.asOf??"")?{detail}:current);},[client,detail,options.queryKey]);
 return <TaskDetailView detail={response.data?.detail??detail} page={page} teamPage={teamPage} participant={participant} locale={locale}/>;
}
