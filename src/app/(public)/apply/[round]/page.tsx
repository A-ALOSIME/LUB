import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {getRound} from "@/features/forms/repository";

/** Resolve historic list links to the canonical, organization-scoped route. */
export default async function RoundLink({params}:{params:Promise<{round:string}>}){
 const {round}=await params;
 if(!z.uuid().safeParse(round).success)notFound();
 const user=await getVerifiedUser(),data=await getRound(round,user?.id);
 if(!data?.version)notFound();
 redirect(`/organizations/${data.slug}/apply/${round}`);
}
