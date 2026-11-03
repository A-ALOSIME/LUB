import {queryOptions} from "@tanstack/react-query";
import {privateJson} from "@/lib/private-query";
import type {loadTaskPanel} from "./task-panel-actions";
import type {TaskPanelQuery} from "./task-detail";
export const initialTaskPanelQuery:TaskPanelQuery={page:0,teamPage:0,eventPage:0,participant:null};
export function taskPanelQuery(actor:string|null,task:string,query:TaskPanelQuery=initialTaskPanelQuery){
 const params=new URLSearchParams({page:String(query.page),teamPage:String(query.teamPage),eventPage:String(query.eventPage),purpose:query.purpose??"edit",...(query.participant?{participant:query.participant}:{})});
 return queryOptions({queryKey:["task-panel",actor,task,query],queryFn:({signal})=>privateJson<Awaited<ReturnType<typeof loadTaskPanel>>>(`/api/tasks/${task}?${params}`,signal)});
}
