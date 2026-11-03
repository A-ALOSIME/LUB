import {z} from "zod";
import {cookies} from "next/headers";
import {getVerifiedUser} from "@/features/auth/session";
import {decryptIdentifier} from "@/lib/identifiers";
import {organizationApplicationPage} from "@/features/forms/repository";
const input=z.object({q:z.string().max(120).default(""),status:z.enum(["","Submitted","Interview","Accepted","Rejected","Withdrawn"]).default(""),committee:z.string().refine(value=>!value||z.uuid().safeParse(value).success).default(""),round:z.string().refine(value=>!value||z.uuid().safeParse(value).success).default(""),major:z.string().max(120).default(""),level:z.string().max(20).default(""),from:z.string().refine(value=>!value||z.iso.date().safeParse(value).success).default(""),to:z.string().refine(value=>!value||z.iso.date().safeParse(value).success).default(""),activity:z.enum(["","prior","first"]).default(""),page:z.coerce.number().int().min(1).max(1000).default(1)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const org=z.uuid().safeParse((await params).id),filters=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!org.success||!filters.success)return Response.json({error:"Invalid request"},{status:400,headers});
 let lookup="";try{const saved=(await cookies()).get("lub-application-search")?.value;if(saved){const value=decryptIdentifier(saved,`application-search:${user.id}:${org.data}`);if(/^[a-f0-9]{64}$/.test(value))lookup=value;}}catch{/* Invalid lookup cookies never expand scope. */}
 request.signal.throwIfAborted();const data=await organizationApplicationPage(user.id,org.data,{...filters.data,lookup});request.signal.throwIfAborted();return Response.json(data,{headers});
}
