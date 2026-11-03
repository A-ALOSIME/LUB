import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {listTasks} from "@/features/tasks/repository";
const input=z.object({status:z.enum(["","Draft","Open","Completed","Cancelled"]).default(""),q:z.string().max(120).default(""),sort:z.enum(["asc","desc"]).default("desc"),page:z.coerce.number().int().min(0).max(10000).default(0)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});const org=z.uuid().safeParse((await params).id),query=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!org.success||!query.success)return Response.json({error:"Invalid request"},{status:400,headers});
 try{request.signal.throwIfAborted();const data=await listTasks(user.id,{org:org.data,view:"all",...query.data});request.signal.throwIfAborted();return Response.json(data,{headers});}catch{return Response.json({error:"Unavailable"},{status:503,headers});}
}
