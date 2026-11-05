import {notFound} from "next/navigation";
import {getPreferences} from "@/lib/preferences";
import {localizedMetadata} from "@/lib/localized-metadata";
import {requireVerifiedProxyIdentity} from "@/features/auth/session";
import {adminDirectory} from "@/features/organizations/admin-directory-repository";
import {AdminDirectoryScreen} from "@/features/organizations/admin-directory-screen";
export async function generateMetadata(){return localizedMetadata("الجهات","Organizations");}
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const [user,{locale},query]=await Promise.all([requireVerifiedProxyIdentity(),getPreferences(),searchParams]);
 const data=await adminDirectory(user.id);if(!data)notFound();
 return <AdminDirectoryScreen initial={data} initialSearch={new URLSearchParams(Object.entries(query).filter((entry):entry is [string,string]=>typeof entry[1]==="string")).toString()} locale={locale}/>;
}
