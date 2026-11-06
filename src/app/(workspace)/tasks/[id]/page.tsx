import {BackLink} from "@/components/back-link";
import {taskReturnPath} from "@/features/tasks/task-navigation";
import {t as translateUi} from "@/lib/i18n";
import {localizedMetadata} from "@/lib/localized-metadata";


import {notFound} from "next/navigation";
import {z} from "zod";
import {requireManagementUser as requireUser} from "@/features/organizations/access";
import {taskDetail} from "@/features/tasks/repository";
import {FullTaskPage} from "@/features/tasks/full-task-page";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('تفاصيل المهمة','Task details');}
export default async function TaskPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string;participant?:string;page?:string;teamPage?:string;eventPage?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const query=await searchParams;
const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.page??0);const teamPage=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.teamPage??0);
 const detail=await taskDetail(user.id,id,null,page,teamPage,"student");if(!detail)notFound();

 return <><main id="main" className="min-w-0"><BackLink className="mb-6" href={taskReturnPath(query.returnTo,"/activity?tab=tasks")}>{translateUi((locale==="en") ? "en" : "ar", "الرجوع للمهام", "Back to tasks")}</BackLink><FullTaskPage detail={detail} page={page} teamPage={teamPage} participant={null} locale={locale}/></main></>;
}
