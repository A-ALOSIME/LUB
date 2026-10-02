import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireUser} from "@/features/auth/session";
import {checkReadiness} from "@/features/hours/view";
import {documentWorkspace} from "@/features/documents/repository";
import {DocumentWorkspaceView} from "@/features/documents/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('التقارير والمستندات','Reports and documents');}
export default async function DocumentsWorkspace({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{committee?:string;page?:string;memberPage?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),{id}=await params,q=await searchParams;if(!z.uuid().safeParse(id).success)notFound();
 const committee=z.uuid().nullable().catch(null).parse(q.committee??null),number=(v?:string)=>z.coerce.number().int().min(0).max(10000).catch(0).parse(v??0),page=number(q.page),memberPage=number(q.memberPage);
 const data=await documentWorkspace(user.id,id,committee,page,memberPage);if(!data)notFound();checkReadiness(data.account);
 return <DocumentWorkspaceView data={data} org={id} committee={committee} page={page} memberPage={memberPage} locale={locale}/>;
}
