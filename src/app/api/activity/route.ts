import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {studentOperationError} from "@/features/auth/authorization";
import {activityRevision} from "@/features/activity/revision";
import {loadActivitySnapshot} from "@/features/activity/activity-data-actions";
import {listTasks} from "@/features/tasks/repository";
import {myEvents,listEvents} from "@/features/events/repository";
import {myHours} from "@/features/hours/repository";
const input=z.object({tab:z.enum(["tasks","events","hours"]),view:z.enum(["available","mine"]).default("mine"),q:z.string().max(120).default(""),status:z.string().max(30).default("all"),term:z.uuid().optional(),page:z.coerce.number().int().min(0).max(10000).default(0),sort:z.enum(["asc","desc"]).default("desc")});
export async function GET(request:Request){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();
 if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 if(await studentOperationError(user.id))return Response.json({error:"Forbidden"},{status:403,headers});
 const search=new URL(request.url).searchParams;request.signal.throwIfAborted();
 if(search.get("version")==="1")return Response.json({version:await activityRevision(user.id)},{headers});
 if(!search.has("tab")){const data=await loadActivitySnapshot();request.signal.throwIfAborted();return Response.json(data,{headers});}
 const parsed=input.safeParse(Object.fromEntries(search));if(!parsed.success)return Response.json({error:"Invalid request"},{status:400,headers});
 const f=parsed.data;
 const data=f.tab==="tasks"?await listTasks(user.id,{view:f.view,page:f.page,q:f.q,sort:f.sort}):f.tab==="events"?f.view==="available"?{available:await listEvents(f.q,"upcoming",f.page,null,true)}:await myEvents(user.id,f.page,f):await myHours(user.id,f.term??null,f.page,({approved:"Approved",pending:"Pending",rejected:"Rejected"} as Record<string,string>)[f.status]??null,f.q);
 request.signal.throwIfAborted();return Response.json(data,{headers});
}
