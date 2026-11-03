import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {campaignList} from "@/features/renewals/campaign-list-repository";
const input=z.object({kind:z.enum(["all","round","renewal"]).default("all"),status:z.enum(["all","Draft","Open","Paused","Closed","Archived"]).default("all"),q:z.string().max(120).default(""),sort:z.enum(["asc","desc"]).default("desc"),page:z.coerce.number().int().min(0).max(10000).default(0)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const org=z.uuid().safeParse((await params).id),filters=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!org.success||!filters.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const data=await campaignList(user.id,org.data,filters.data);request.signal.throwIfAborted();return Response.json(data,{headers});
}
