"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { identifierLookup,encryptIdentifier } from "@/lib/identifiers";
import { universityIdSchema } from "@/lib/validation";
import { getAppOrigin } from "@/lib/env";
export async function searchApplications(form:FormData) {
 const user=await requireUser();const org=z.uuid().parse(form.get("org"));const query=new URLSearchParams();
 for(const key of ["q","status","committee","major","level","from","to","activity"]) {const value=form.get(key);if(typeof value==="string"&&value.length<=120&&value)query.set(key,value);}
 const university=universityIdSchema.safeParse(form.get("university"));
 const cookie=await cookies();if(university.success)cookie.set("lub-application-search",encryptIdentifier(identifierLookup(university.data),`application-search:${user.id}:${org}`),{httpOnly:true,sameSite:"lax",secure:getAppOrigin().startsWith("https:"),path:"/manage",maxAge:600});else cookie.delete("lub-application-search");
 redirect(`/manage/organizations/${org}/applications?${query}`);
}
