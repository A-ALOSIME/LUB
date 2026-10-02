import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireUser} from "@/features/auth/session";
import {hoursWorkspace} from "@/features/hours/repository";
import {checkReadiness} from "@/features/hours/view";
import {HoursWorkspaceView} from "@/features/hours/workspace-view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('إدارة الساعات','Manage hours');}
export default async function ManageHoursPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string;term?:string;committee?:string;memberPage?:string;rulePage?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),{id}=await params,q=await searchParams;if(!z.uuid().safeParse(id).success)notFound();const page=(value?:string)=>z.coerce.number().int().min(0).max(10000).catch(0).parse(value??0),uuid=(value?:string)=>z.uuid().nullable().catch(null).parse(value??null);
 const filters={page:page(q.page),memberPage:page(q.memberPage),rulePage:page(q.rulePage),term:uuid(q.term),committee:uuid(q.committee)};const data=await hoursWorkspace(user.id,id,filters);if(!data)notFound();checkReadiness(data.account);
 return <HoursWorkspaceView data={data} org={id} filters={filters} locale={locale}/>;
}
