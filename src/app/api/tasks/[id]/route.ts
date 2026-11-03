import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {loadTaskPanel} from "@/features/tasks/task-panel-actions";
const input=z.object({page:z.coerce.number().int().min(0).max(1000).default(0),teamPage:z.coerce.number().int().min(0).max(1000).default(0),eventPage:z.coerce.number().int().min(0).max(1000).default(0),participant:z.uuid().nullable().default(null)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();
 if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const id=z.uuid().safeParse((await params).id),query=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!id.success||!query.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const result=await loadTaskPanel(id.data,query.data);request.signal.throwIfAborted();return Response.json(result,{headers});
}
