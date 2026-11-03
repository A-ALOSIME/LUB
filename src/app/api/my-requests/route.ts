import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {studentOperationError} from "@/features/auth/authorization";
import {ownRequestPage} from "@/features/forms/own-request-repository";
const input=z.object({tab:z.enum(["applications","renewals","organizations"]).default("applications"),status:z.enum(["all","Submitted","Interview","Accepted","Rejected","Withdrawn","Pending","Renewed","Declined","No_Response"]).default("all"),q:z.string().trim().max(120).default(""),sort:z.enum(["asc","desc"]).default("desc"),page:z.coerce.number().int().min(0).max(10000).default(0)});
export async function GET(request:Request){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const filters=input.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!filters.success)return Response.json({error:"Invalid request"},{status:400,headers});
 if(await studentOperationError(user.id))return Response.json({error:"Unavailable"},{status:403,headers});
 try{request.signal.throwIfAborted();const data=await ownRequestPage(user.id,filters.data);request.signal.throwIfAborted();return Response.json(data,{headers});}catch{return Response.json({error:"Unavailable"},{status:503,headers});}
}
