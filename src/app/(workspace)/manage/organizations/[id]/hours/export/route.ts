import {getPreferences} from "@/lib/preferences";
import {createClient} from "@/lib/supabase/server";
import {getAuthConfig} from "@/lib/env";
import { z } from "zod";
import { getVerifiedUser } from "@/features/auth/session";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const optionalUuid = z.uuid().nullable();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getVerifiedUser();
  if (!user) return new Response(null, { status: 401, headers: privateHeaders });

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = z.object({
    organization: z.uuid(),
    committee: optionalUuid,
    term: optionalUuid,
    status:z.enum(["Approved","Pending","Rejected"]).nullable(),
    q:z.string().trim().max(120),
  }).safeParse({
    organization: id,
    committee: url.searchParams.get("committee") || null,
    term: url.searchParams.get("term") || null,
    status:url.searchParams.get("status")||null,
    q:url.searchParams.get("q")||"",
  });
  if (!parsed.success) return new Response(null, { status: 400, headers: privateHeaders });

  try {
    const { organization, committee, term,status,q } = parsed.data,config=getAuthConfig();if(!config)return new Response(null,{status:503,headers:privateHeaders});
    const {data:{session}}=await (await createClient()).auth.getSession();if(!session||session.user.id!==user.id)return new Response(null,{status:401,headers:privateHeaders});
    const {locale}=await getPreferences(),response=await fetch(`${config.url}/functions/v1/export-hours`,{method:"POST",headers:{authorization:`Bearer ${session.access_token}`,apikey:config.key,"content-type":"application/json"},body:JSON.stringify({org:organization,committee,term,state:status,q,locale}),cache:"no-store",signal:AbortSignal.timeout(30000)});
    if(!response.ok)return new Response(null,{status:[400,401,403,429,503].includes(response.status)?response.status:502,headers:privateHeaders});
    return new Response(response.body,{headers:{...privateHeaders,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":response.headers.get("Content-Disposition")??'attachment; filename="hours.xlsx"'}});
  } catch {
    return new Response(null, { status:503, headers:privateHeaders });
  }
}
