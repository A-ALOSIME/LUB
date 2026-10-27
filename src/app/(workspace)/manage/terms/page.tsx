import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {requireVerifiedProxyIdentity} from "@/features/auth/session";
import {termWorkspace} from "@/features/hours/repository";
import {checkReadiness} from "@/features/hours/view";
import {TermForm} from "@/features/hours/term-form";
import {TermList} from "@/features/hours/term-list";
import {getPreferences} from "@/lib/preferences";
import {isSuperAdminUser} from "@/features/auth/authorization";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
export async function generateMetadata(){return localizedMetadata("الفصول الأكاديمية","Academic terms");}
export default async function TermsPage(){
 const [user,{locale}]=await Promise.all([requireVerifiedProxyIdentity(),getPreferences()]),en=locale==="en";
 const data=await termWorkspace(user.id);
 if(!await isSuperAdminUser(user.id))checkReadiness(data?.account);
 if(!data?.canManage)notFound();
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return <div className="flex flex-col gap-8">
  <div><h1 className="text-3xl font-bold">{en?"Academic terms":"الفصول الأكاديمية"}</h1><p className="mt-3 leading-8 text-muted-foreground">{en?"Define official terms and dates before approving task hours. Saved terms are fixed and their dates cannot overlap.":"عرّف الفصول الرسمية وتواريخها قبل اعتماد ساعات المهام. الفصل المحفوظ ثابت، ولا تتداخل تواريخ الفصول."}</p></div>
  <Card><CardHeader><CardTitle>{en?"Add term":"إضافة فصل"}</CardTitle></CardHeader><CardContent><TermForm locale={locale}/></CardContent></Card>
  <TermList terms={data.terms} locale={locale} today={today}/>
 </div>;
}
