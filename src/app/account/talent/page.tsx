import {localizedMetadata} from "@/lib/localized-metadata";
import {redirect} from "next/navigation";
import {AccountHeader} from "@/components/account-header";
import {requireUser} from "@/features/auth/session";
import {talentWorkspace,talentPages} from "@/features/talent/repository";
import {TalentWorkspaceView} from "@/features/talent/workspace-view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('ملفي المهاري والخصوصية','Talent profile and privacy');}
export default async function ManageTalent({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const pages=talentPages(await searchParams);const data=await talentWorkspace(user.id,pages);if(data?.status==="Inactive")redirect("/account-unavailable");if(!data?.onboarded)redirect("/onboarding");return <><AccountHeader/><main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><TalentWorkspaceView data={data} user={user.id} pages={pages} locale={locale}/></main></>;}
