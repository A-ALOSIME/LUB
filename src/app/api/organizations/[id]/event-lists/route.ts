import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {organizationEventsVersion} from "@/features/events/management-version";
import {loadOrganizationEvents} from "@/features/events/management-cache-actions";
import {eventWorkspaceOverview} from "@/features/events/workspace";
import {eventRegistrants} from "@/features/events/review-repository";
const input=z.object({section:z.enum(["events","announcements","registrants"]),eventStatus:z.enum(["all","Published","Draft","Cancelled","Archived"]).default("all"),eventSearch:z.string().max(120).default(""),sort:z.enum(["asc","desc"]).default("desc"),page:z.coerce.number().int().min(0).max(10000).default(0),announcementStatus:z.enum(["all","published","draft","archived"]).default("all"),announcementSearch:z.string().max(120).default(""),announcementSort:z.enum(["asc","desc"]).default("desc"),announcementPage:z.coerce.number().int().min(0).max(10000).default(0),q:z.string().max(120).default(""),review:z.enum(["","Pending","Accepted","Rejected"]).default(""),eventFilter:z.uuid().optional(),registrationPage:z.coerce.number().int().min(0).max(10000).default(0)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store"},user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});
 const id=z.uuid().safeParse((await params).id),search=new URL(request.url).searchParams;if(!id.success)return Response.json({error:"Invalid request"},{status:400,headers});
 request.signal.throwIfAborted();
 if(search.get("version")==="1")return Response.json({version:await organizationEventsVersion(user.id,id.data)},{headers});
 if(!search.has("section")){const data=await loadOrganizationEvents(id.data);request.signal.throwIfAborted();return Response.json(data,{headers});}
 const parsed=input.safeParse(Object.fromEntries(search));if(!parsed.success)return Response.json({error:"Invalid request"},{status:400,headers});
 const f=parsed.data,workspace=await eventWorkspaceOverview(user.id,id.data,f.page,f);if(!workspace)return Response.json({error:"Forbidden"},{status:403,headers});
 const registrations=f.section==="registrants"&&workspace.canViewEvents?await eventRegistrants(user.id,id.data,f.eventFilter??null,f.q,f.review,f.registrationPage,false):null;
 request.signal.throwIfAborted();return Response.json({workspace,registrations},{headers});
}
