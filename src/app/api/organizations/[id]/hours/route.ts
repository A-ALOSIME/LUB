import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {hoursWorkspace} from "@/features/hours/repository";
const input=z.object({term:z.uuid().optional(),committee:z.uuid().optional(),status:z.enum(["Approved","Pending","Rejected"]).optional(),q:z.string().max(120).default(""),page:z.coerce.number().int().min(0).max(10000).default(0)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const org=z.uuid().safeParse((await params).id),f=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!org.success||!f.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const data=await hoursWorkspace(user.id,org.data,{...f.data,term:f.data.term??null,committee:f.data.committee??null,memberPage:0});request.signal.throwIfAborted();
 if(!data)return Response.json({error:"Forbidden"},{status:403,headers});
 const {records,hoursByStatus,total,filteredTotal,filteredCount}=data;return Response.json({records,hoursByStatus,total,filteredTotal,filteredCount},{headers});
}
