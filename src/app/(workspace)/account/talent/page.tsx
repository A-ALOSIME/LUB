import {getMyPageData} from "@/features/organizations/my-page-repository";
import type {PublicTalent} from "@/features/talent/repository";
import {localizedMetadata} from "@/lib/localized-metadata";
import {redirect} from "next/navigation";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {talentWorkspace,talentPages} from "@/features/talent/repository";
import {TalentWorkspaceView} from "@/features/talent/workspace-view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('ملفي المهاري والخصوصية','Talent profile and privacy');}
export default async function ManageTalent({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const pages=talentPages(await searchParams);const data=await talentWorkspace(user.id,pages);if(data?.status==="Inactive")redirect("/account-unavailable");if(!data?.onboarded)redirect("/onboarding");const {memberships}=await getMyPageData(user.id);const grouped=new Map<string,PublicTalent["organizations"][number]>();for(const m of memberships){let org=grouped.get(m.slug);if(!org){org={id:m.slug,slug:m.slug,name:m.organizationName,logo:m.logo,type:m.type,archived:m.organizationStatus==="Archived",hours:m.hours,memberships:[]};grouped.set(m.slug,org);}org.memberships.push({start_date:m.startDate,end_date:m.endDate,status_code:m.statusCode,roles:m.roles.map(r=>({code:r.code,starts:r.startDate,ends:r.endDate,hours:r.hours}))});}return <TalentWorkspaceView memberships={[...grouped.values()]} data={data} user={user.id} pages={pages} locale={locale}/>;}
