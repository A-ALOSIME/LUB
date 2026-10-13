import {localizedMetadata} from "@/lib/localized-metadata";
import {z} from "zod";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {myHours} from "@/features/hours/repository";
import {checkReadiness} from "@/features/hours/view";
import {PersonalHoursView} from "@/features/hours/workspace-view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('ساعاتي','My hours');}
export default async function HoursPage({searchParams}:{searchParams:Promise<{page?:string;term?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),q=await searchParams;const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(q.page??0),term=z.uuid().nullable().catch(null).parse(q.term??null);
 const data=await myHours(user.id,term,page);checkReadiness(data?.account);if(!data)throw new Error("Hours storage unavailable");
 return <><main id="main" className="min-w-0"><PersonalHoursView data={data} page={page} term={term} locale={locale}/></main></>;
}
