import {localizedMetadata} from "@/lib/localized-metadata";
import {redirect} from "next/navigation";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {talentWorkspace,talentPages} from "@/features/talent/repository";
import {TalentWorkspaceView} from "@/features/talent/workspace-view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('ملفي المهاري والخصوصية','Talent profile and privacy');}
export default async function ManageTalent({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const pages=talentPages(await searchParams);const data=await talentWorkspace(user.id,pages);if(data?.status==="Inactive")redirect("/account-unavailable");if(!data?.onboarded)redirect("/onboarding");return <TalentWorkspaceView data={data} user={user.id} pages={pages} locale={locale}/>;}
