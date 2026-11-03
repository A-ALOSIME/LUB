"use server";

import {z} from "zod";
import {requireStudentManagementUser} from "@/features/organizations/access";
import {taskDetail,taskWorkspace,type TaskDetail,type TaskWorkspace} from "./repository";

const querySchema=z.object({
  page:z.number().int().min(0).max(1000).default(0),
  teamPage:z.number().int().min(0).max(1000).default(0),
  eventPage:z.number().int().min(0).max(1000).default(0),
  purpose:z.enum(["edit","link"]).default("edit"),
  participant:z.uuid().nullable().default(null),
});
type PanelResult={detail:TaskDetail;workspace?:TaskWorkspace;error?:never}|{error:string;detail?:never;workspace?:never};

export async function loadTaskPanel(task:string,query:unknown={}):Promise<PanelResult>{
  const user=await requireStudentManagementUser();
  const id=z.uuid().safeParse(task),parsed=querySchema.safeParse(query);
  if(!id.success||!parsed.success)return {error:"تعذّر عرض المهمة. حدّث الصفحة وحاول مرة ثانية."};
  try{
    const {participant,page,teamPage,purpose}=parsed.data;
    const detail=await taskDetail(user.id,id.data,participant,page,teamPage,"management",purpose==="link",false);
    if(!detail)return {error:"المهمة غير متاحة أو لا تملك صلاحية عرضها."};
    const workspace=detail.canManage&&purpose==="edit"?await taskWorkspace(user.id,detail.task.organization_id):undefined;
    return {detail,workspace};
  }catch{
    return {error:"تعذّر عرض المهمة. حدّث الصفحة وحاول مرة ثانية."};
  }
}
