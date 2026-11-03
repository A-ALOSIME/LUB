import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {templateList} from "@/features/forms/template-list-repository";
const input=z.object({q:z.string().max(120).default(""),status:z.enum(["all","Draft","Published"]).default("all"),page:z.coerce.number().int().min(0).max(10000).default(0)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const id=z.uuid().safeParse((await params).id),f=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!id.success||!f.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const data=await templateList(user.id,id.data,f.data);request.signal.throwIfAborted();return Response.json(data,{headers});
}
