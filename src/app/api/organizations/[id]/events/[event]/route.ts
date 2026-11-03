import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {eventEditor} from "@/features/events/editor-repository";
export async function GET(request:Request,{params}:{params:Promise<{id:string;event:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const parsed=z.object({id:z.uuid(),event:z.uuid()}).safeParse(await params);if(!parsed.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const data=await eventEditor(user.id,parsed.data.id,parsed.data.event);request.signal.throwIfAborted();return Response.json(data??{error:"Forbidden"},{status:data?200:403,headers});
}
