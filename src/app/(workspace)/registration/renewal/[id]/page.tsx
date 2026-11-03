import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowRight} from "lucide-react";
import {z} from "zod";
import {requireManagementUser} from "@/features/organizations/access";
import {renewalParticipantPage} from "@/features/renewals/participant-repository";
import {renewalParticipantFilters} from "@/features/renewals/participant-types";
import {RenewalParticipantTable} from "@/features/renewals/participant-table";
import {getPreferences} from "@/lib/preferences";
import {createTranslator} from "@/lib/i18n";
import {localizedMetadata} from "@/lib/localized-metadata";
import {ContentText} from "@/components/content-text";
import {Button} from "@/components/ui/button";
export async function generateMetadata(){return localizedMetadata("نتائج التجديد","Renewal results");}
export default async function RenewalPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const [user,{locale},{id},query]=await Promise.all([requireManagementUser(),getPreferences(),params,searchParams]);if(!z.uuid().safeParse(id).success)notFound();
 const parsed=renewalParticipantFilters.safeParse(query);if(!parsed.success)notFound();const data=await renewalParticipantPage(user.id,id,parsed.data);if(!data)notFound();const t=createTranslator(locale);
 return <main id="main" className="flex min-w-0 flex-col gap-5"><Button variant="ghost" className="self-start" nativeButton={false} render={<Link href={`/manage/organizations/${data.organization}/renewals`}/>}><ArrowRight className="ltr:rotate-180"/>{t("رجوع للحملات","Back to campaigns")}</Button><h1><ContentText value={data.title}/></h1><RenewalParticipantTable campaign={id} initial={data} initialFilters={parsed.data} locale={locale}/></main>;
}
