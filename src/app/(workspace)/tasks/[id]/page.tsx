import {t as translateUi} from "@/lib/i18n";
import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {ArrowLeft} from "lucide-react";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireManagementUser as requireUser} from "@/features/organizations/access";
import {taskDetail} from "@/features/tasks/repository";
import {TaskDetailView} from "@/features/tasks/task-detail";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('تفاصيل المهمة','Task details');}
export default async function TaskPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{participant?:string;page?:string;teamPage?:string;eventPage?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const query=await searchParams;
const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.page??0);const teamPage=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.teamPage??0);
 const detail=await taskDetail(user.id,id,null,page,teamPage,"student");if(!detail)notFound();

 return <><main id="main" className="min-w-0"><Button className="mb-6" variant="ghost" size="sm" nativeButton={false} render={<Link href="/activity?tab=tasks"/>}><ArrowLeft className="rtl:rotate-180"/>{translateUi((locale==="en") ? "en" : "ar", "الرجوع للمهام", "Back to tasks")}</Button><TaskDetailView detail={detail} page={page} teamPage={teamPage} participant={null} locale={locale}/></main></>;
}
