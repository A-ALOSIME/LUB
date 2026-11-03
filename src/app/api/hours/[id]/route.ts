import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {getHourRecord} from "@/features/hours/repository";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const id=z.uuid().safeParse((await params).id);if(!id.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const record=await getHourRecord(user.id,id.data);request.signal.throwIfAborted();return record?Response.json(record,{headers}):Response.json({error:"Not found"},{status:404,headers});
}
