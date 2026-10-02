import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {AccountHeader} from "@/components/account-header";
import {requireManagementUser} from "@/features/organizations/access";
import {taskDetail} from "@/features/tasks/repository";
import {TaskDetailView} from "@/features/tasks/task-detail";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('تفاصيل المهمة','Task details');}
export default async function TaskPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{participant?:string;page?:string;teamPage?:string;eventPage?:string}>}){
 const [user,{locale}]=await Promise.all([requireManagementUser(),getPreferences()]);const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const query=await searchParams;
 const participant=z.uuid().safeParse(query.participant);const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.page??0);const eventPage=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.eventPage??0);const teamPage=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.teamPage??0);
 const detail=await taskDetail(user.id,id,participant.success?participant.data:null,page,teamPage,eventPage);if(!detail)notFound();
 return <><AccountHeader/><main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link className="text-link mb-6 inline-block" href="/tasks">{locale==="en"?"All tasks":"جميع المهام"}</Link><TaskDetailView eventPage={eventPage} detail={detail} page={page} teamPage={teamPage} participant={participant.success?participant.data:null} locale={locale}/></main></>;
}
