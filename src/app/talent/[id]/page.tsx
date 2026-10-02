import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {z} from "zod";
import {PublicHeader} from "@/components/public-header";
import {publicTalent,talentPages} from "@/features/talent/repository";
import {PublicTalentView} from "@/features/talent/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('الملف المهاري','Talent profile', { robots: { index: false, follow: false } });}
export default async function TalentProfile({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const [pages,{locale}]=await Promise.all([searchParams.then(talentPages),getPreferences()]);const profile=await publicTalent(id,pages);if(!profile)notFound();return <><PublicHeader/><main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><PublicTalentView profile={profile} pages={pages} locale={locale}/></main></>;}
