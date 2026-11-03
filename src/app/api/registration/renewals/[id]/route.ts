import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {renewalParticipantPage} from "@/features/renewals/participant-repository";
import {renewalParticipantFilters} from "@/features/renewals/participant-types";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const id=z.uuid().safeParse((await params).id),filters=renewalParticipantFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!id.success||!filters.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();try{const data=await renewalParticipantPage(user.id,id.data,filters.data);request.signal.throwIfAborted();return data?Response.json(data,{headers}):Response.json({error:"Forbidden"},{status:403,headers});}catch{return Response.json({error:"Unavailable"},{status:503,headers});}
}
