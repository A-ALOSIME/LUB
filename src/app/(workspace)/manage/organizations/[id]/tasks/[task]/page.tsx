import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {ArrowRight} from "lucide-react";
import {requireManagementUser} from "@/features/organizations/access";
import {taskDetail} from "@/features/tasks/repository";
import {TaskDetailView} from "@/features/tasks/task-detail";
import {getPreferences} from "@/lib/preferences";
import {localizedMetadata} from "@/lib/localized-metadata";
import {createTranslator} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
export async function generateMetadata(){return localizedMetadata("تفاصيل المهمة","Task details");}
export default async function ManagedTaskPage({params,searchParams}:{params:Promise<{id:string;task:string}>;searchParams:Promise<{page?:string;teamPage?:string;participant?:string}>}){
 const [user,{locale},route,query]=await Promise.all([requireManagementUser(),getPreferences(),params,searchParams]);if(!z.uuid().safeParse(route.id).success||!z.uuid().safeParse(route.task).success)notFound();
 const number=(value?:string)=>z.coerce.number().int().min(0).max(10000).catch(0).parse(value??0),page=number(query.page),teamPage=number(query.teamPage),participant=z.uuid().nullable().catch(null).parse(query.participant??null);
 const detail=await taskDetail(user.id,route.task,participant,page,teamPage,"management");if(!detail?.canManage||detail.task.organization_id!==route.id)notFound();const t=createTranslator(locale);
 return <main id="main" className="flex min-w-0 flex-col gap-5"><Button variant="ghost" className="self-start" nativeButton={false} render={<Link href={`/manage/organizations/${route.id}/tasks`}/>}><ArrowRight className="ltr:rotate-180"/>{t("رجوع للمهام","Back to tasks")}</Button><TaskDetailView detail={detail} page={page} teamPage={teamPage} participant={participant} locale={locale}/></main>;
}
