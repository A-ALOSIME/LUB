import "server-only";
import {cache} from "react";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
export {taskLabels,formatTaskDate} from "./display";
import type {ProfileSkill} from "@/features/talent/profile-skills-model";
export type Task={skills?:ProfileSkill[];id:string;organization_id:string;committee_id:string|null;title:string;description:string;starts_at:string|null;due_at:string|null;default_hours:string;status_code:string;revision:number;event_id?:string|null;image_asset_id?:string|null;has_event_poster?:boolean};
export type Participant={id:string;user_id:string;status_code:string;approved_hours_override:string|null;joined_at:string;closed_at:string|null;withdrawn_at?:string|null};
export type Submission={name?:string;major?:string;level?:string;displayStatus?:string;review_decision_code?:string|null;withdrawn_at?:string|null;id:string;revision_number:number;message:string;status_code:string;submitted_at:string;review_note:string|null;reviewed_at:string|null;assets:Array<{id:string;name:string}>};
export type TaskCard={can_manage?:boolean;summary?:{participants:number;submitted:number}|null;task:Omit<Task,"description">&{description?:string};org_name:string;participant:Participant|null;historical:boolean;latest_submission:{status_code:string}|null;approved_hours:string|null};
export type TaskDetail={approvedHours?:string|null;organizationName?:string;asOf?:string;summary?:{participants:number;submitted:number}|null;task:Task;canReview?:boolean;canManage:boolean;current:boolean;own:Participant|null;selected:Participant|null;lastRevision:number;team:Array<{id:string;name:string;status:string;major?:string;level?:string;joinedAt?:string;committee?:string;isLeader?:boolean;hourRecord?:{id:string;hours:string;canAdjust:boolean}|null}>;submissions:Submission[];linkedEvent:{id:string;title:string;status:string}|null;eventChoices:Array<{id:string;title:string;status:string}>};
export type TaskWorkspace = { name: string; scopes: Array<{ id: string | null; name: string }> };
export async function taskWorkspace(user: string, org: string) {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: TaskWorkspace | null }>(sql`select lub.task_workspace(${org}::uuid) as data`);
    return row?.data ?? undefined;
  });
}

export async function listTasks(user: string, options: { org?: string; view: "available" | "mine" | "all"; page: number | null; q?: string; status?: string; sort?: "asc" | "desc" }) {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: TaskCard[] }>(sql`
      select lub.task_card_page(${options.org ?? null}::uuid,${options.view},${options.page}::int,${options.q ?? ""},${options.status ?? ""},${options.sort === "asc"}) as data`);
    const items = row?.data ?? [];
    return { items: options.page === null ? items : items.slice(0, 25), more: options.page !== null && items.length > 25 };
  });
}


export async function taskDetail(user: string, id: string, participant: string | null = null, _submissionPage = 0, _teamPage = 0, presentation: "student" | "management" = "management", eventChoices = false, includeWork = true) {
  void _submissionPage;
  void _teamPage;
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: TaskDetail | null }>(sql`
      select lub.task_detail(${id}::uuid,${participant}::uuid,${presentation === "management"},${eventChoices},${includeWork}) as data`);
    return row?.data ?? undefined;
  });
}
export type TaskNotification={id:string;type_code:string;title:string;body:string;target_url:string;created_at:string;read_at:string|null};
export const taskNotifications=cache(async(user:string,page:number,unreadOnly=false)=>withUser(user,async tx=>{
 const rows=await tx.execute(sql`select * from lub.notification_feed(${page}::int,${unreadOnly}::boolean)`);
 return rows as unknown as TaskNotification[];
}));
export const taskNotificationCounts=cache(async(user:string)=>withUser(user,async tx=>{
 const rows=await tx.execute(sql`select * from lub.notification_counts()`);
 return rows[0] as unknown as {all:number;unread:number};
}));
