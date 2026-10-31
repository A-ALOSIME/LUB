"use client";
import {useActionState} from "react";
import {UserPlus} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {Spinner} from "@/components/ui/spinner";
import {useActionToast} from "@/components/action-toast";
import {t} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {mutateTask,type TaskState} from "./actions";
export function TaskJoinAction({task,locale}:{task:string;locale:Locale}){
 const [state,action,pending]=useActionState<TaskState,FormData>(async(previous,form)=>{const result=await mutateTask(previous,form);if(result.success)window.dispatchEvent(new Event("activity-changed"));return result;},{});
 useActionToast(state,locale);
 return <form action={action}><input type="hidden" name="operation" value="join"/><input type="hidden" name="task" value={task}/><RowAction type="submit" disabled={pending||Boolean(state.success)} label={t(locale,"الانضمام للمهمة","Join task")}>{pending?<Spinner/>:<UserPlus/>}</RowAction></form>;
}
