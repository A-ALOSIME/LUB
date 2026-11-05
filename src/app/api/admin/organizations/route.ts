import {getVerifiedUser} from "@/features/auth/session";
import {adminDirectory} from "@/features/organizations/admin-directory-repository";
export async function GET(request:Request){const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});request.signal.throwIfAborted();const data=await adminDirectory(user.id);request.signal.throwIfAborted();return data?Response.json(data,{headers}):Response.json({error:"Forbidden"},{status:403,headers});}
