import {localizedMetadata} from "@/lib/localized-metadata";
import {z} from "zod";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {myDocuments} from "@/features/documents/repository";
import {checkReadiness} from "@/features/hours/view";
import {DocumentList,DocumentPager,DocumentsHelp} from "@/features/documents/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('مستنداتي','My documents');}
export default async function DocumentsPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),q=await searchParams,page=z.coerce.number().int().min(0).max(10000).catch(0).parse(q.page??0);
 const data=await myDocuments(user.id,page);checkReadiness(data?.account);if(!data)throw new Error('Documents storage unavailable');
 return <><main id="main" className="space-y-7"><h1 className="text-3xl leading-normal font-bold">{locale==="en"?"My documents":"مستنداتي"}</h1><DocumentsHelp locale={locale}/><DocumentList items={data.items} locale={locale}/><DocumentPager page={page} more={data.items.length>25} href={p=>`/documents?page=${p}`} locale={locale}/></main></>;
}
