"use server";
import {requireStudentUser} from "@/features/auth/authorization";
import {listTasks} from "@/features/tasks/repository";
import {myEvents,listEvents} from "@/features/events/repository";
import {myHours} from "@/features/hours/repository";
import {activityRevision} from "./revision";
import type {ActivitySnapshot} from "./activity-data";
/** Bounded actor-scoped bootstrap; larger collections use server pages. */
export async function loadActivitySnapshot():Promise<ActivitySnapshot>{
 const user=await requireStudentUser();
 // Read the fingerprint first: a concurrent write will still be detected on the next check.
 const version=await activityRevision(user.id);
 const [tasks,mine,events,hours,availableEvents]=await Promise.all([listTasks(user.id,{view:"available",page:null}),listTasks(user.id,{view:"mine",page:null}),myEvents(user.id,null),myHours(user.id,null,null),listEvents("","upcoming",0,null,true)]);
 if(!hours||events.status!=="Active"||!events.onboarded)throw new Error("ACTIVITY_UNAVAILABLE");
 return {actorId:user.id,version,availableEvents,paged:availableEvents.length>24||[tasks.items.length,mine.items.length,events.events.length,hours.records.length].some(count=>count>50),tasks:tasks.items,mine:mine.items,events:events.events,hours};
}
