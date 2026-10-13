import {redirect,notFound} from "next/navigation";
import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {getAccountReadiness} from "@/features/profile/repository";
import {isSuperAdminUser} from "@/features/auth/authorization";
export default async function RegisterEvent({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const next=encodeURIComponent(`/events/${id}/register`);const user=await getVerifiedUser();if(!user)redirect(`/login?next=${next}`);if(await isSuperAdminUser(user.id))redirect("/manage");const readiness=await getAccountReadiness(user.id);if(readiness.status==="Inactive")redirect("/account-unavailable");if(!readiness.onboarded)redirect(`/onboarding?next=${next}`);redirect(`/events/${id}`);}
