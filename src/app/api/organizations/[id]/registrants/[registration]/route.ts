import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {eventRegistrants} from "@/features/events/review-repository";
export async function GET(request:Request,{params}:{params:Promise<{id:string;registration:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const parsed=z.object({id:z.uuid(),registration:z.uuid()}).safeParse(await params);if(!parsed.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const data=await eventRegistrants(user.id,parsed.data.id,null,"","",0,true,parsed.data.registration);request.signal.throwIfAborted();
 return data.items[0]?Response.json(data.items[0],{headers}):Response.json({error:"Not found"},{status:404,headers});
}
