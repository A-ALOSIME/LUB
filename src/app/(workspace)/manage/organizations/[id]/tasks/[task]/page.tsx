import {BackLink} from "@/components/back-link";
import {taskReturnPath} from "@/features/tasks/task-navigation";
import {notFound} from "next/navigation";
import {z} from "zod";

import {requireManagementUser} from "@/features/organizations/access";
import {taskDetail} from "@/features/tasks/repository";
import {FullTaskPage} from "@/features/tasks/full-task-page";
import {getPreferences} from "@/lib/preferences";
import {localizedMetadata} from "@/lib/localized-metadata";
import {createTranslator} from "@/lib/i18n";

export async function generateMetadata(){return localizedMetadata("تفاصيل المهمة","Task details");}
export default async function ManagedTaskPage({params,searchParams}:{params:Promise<{id:string;task:string}>;searchParams:Promise<{returnTo?:string;page?:string;teamPage?:string;participant?:string}>}){
 const [user,{locale},route,query]=await Promise.all([requireManagementUser(),getPreferences(),params,searchParams]);if(!z.uuid().safeParse(route.id).success||!z.uuid().safeParse(route.task).success)notFound();
 const number=(value?:string)=>z.coerce.number().int().min(0).max(10000).catch(0).parse(value??0),page=number(query.page),teamPage=number(query.teamPage),participant=z.uuid().nullable().catch(null).parse(query.participant??null);
 const detail=await taskDetail(user.id,route.task,participant,page,teamPage,"management");if(!detail?.canManage||detail.task.organization_id!==route.id)notFound();const t=createTranslator(locale);
 return <main id="main" className="flex min-w-0 flex-col gap-5"><BackLink href={taskReturnPath(query.returnTo,`/manage/organizations/${route.id}/tasks`)}>{t("رجوع للمهام","Back to tasks")}</BackLink><FullTaskPage detail={detail} page={page} teamPage={teamPage} participant={participant} locale={locale}/></main>;
}
