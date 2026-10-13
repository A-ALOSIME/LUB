import {localizedMetadata} from "@/lib/localized-metadata";
import {z} from "zod";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {myRenewals} from "@/features/renewals/repository";
import {checkReadiness} from "@/features/hours/view";
import {PersonalRenewalsView} from "@/features/renewals/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('تجديد عضوياتي','My membership renewals');}
export default async function RenewalsPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),q=await searchParams;const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(q.page??0);const data=await myRenewals(user.id,page);checkReadiness(data?.account);if(!data)throw new Error("Renewal storage unavailable");
 return <><main id="main" className="min-w-0"><PersonalRenewalsView data={data} page={page} locale={locale}/></main></>;
}
