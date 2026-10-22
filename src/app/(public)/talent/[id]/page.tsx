import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {z} from "zod";
import {publicTalent,talentPages} from "@/features/talent/repository";
import {PublicTalentView} from "@/features/talent/view";
import {getPreferences} from "@/lib/preferences";
import {getVerifiedUser} from "@/features/auth/session";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import {ArrowLeft, ArrowRight} from "lucide-react";
export async function generateMetadata(){return localizedMetadata('الملف المهاري','Talent profile', { robots: { index: false, follow: false } });}
export default async function TalentProfile({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const [pages,{locale},identity]=await Promise.all([searchParams.then(talentPages),getPreferences(),getVerifiedUser()]);const profile=await publicTalent(id,pages);if(!profile)notFound();const en=locale==="en";const ownProfile=identity?.id===id;const backHref=ownProfile?"/account/talent":"/talent";const backLabel=ownProfile?(en?"Back to my talent profile":"العودة للملف المهاري"):(en?"Back to talent discovery":"العودة لاكتشاف المواهب");return <><main id="main" dir={en?"ltr":"rtl"} className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6 sm:gap-5 sm:px-8 sm:py-8"><div className="flex items-center gap-4"><Button render={<Link href={backHref} />} variant="outline" className="w-fit gap-2 no-underline">{backLabel}{en?<ArrowLeft aria-hidden="true"/>:<ArrowRight aria-hidden="true"/>}</Button></div><PublicTalentView profile={profile} pages={pages} locale={locale}/></main></>;}
