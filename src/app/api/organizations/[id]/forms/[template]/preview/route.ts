import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {formPreview} from "@/features/forms/template-list-repository";
export async function GET(request:Request,{params}:{params:Promise<{id:string;template:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const input=z.object({id:z.uuid(),template:z.uuid()}).safeParse(await params);if(!input.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();const data=await formPreview(user.id,input.data.id,input.data.template);request.signal.throwIfAborted();return data?Response.json(data,{headers}):Response.json({error:"Not found"},{status:404,headers});
}
