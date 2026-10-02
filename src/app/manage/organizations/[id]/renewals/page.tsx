import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireUser} from "@/features/auth/session";
import {renewalWorkspace} from "@/features/renewals/repository";
import {checkReadiness} from "@/features/hours/view";
import {RenewalWorkspaceView} from "@/features/renewals/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('إدارة التجديد','Manage renewals');}
export default async function ManageRenewalsPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{campaign?:string;page?:string;memberPage?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),{id}=await params,q=await searchParams;if(!z.uuid().safeParse(id).success)notFound();const number=(value?:string)=>z.coerce.number().int().min(0).max(10000).catch(0).parse(value??0),page=number(q.page),memberPage=number(q.memberPage),campaign=z.uuid().nullable().catch(null).parse(q.campaign??null);
 const data=await renewalWorkspace(user.id,id,campaign,page,memberPage);if(!data)notFound();checkReadiness(data.account);return <RenewalWorkspaceView data={data} org={id} page={page} memberPage={memberPage} locale={locale}/>;
}
