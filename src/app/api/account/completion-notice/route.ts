import {claimProfileCompletionNotice} from "@/features/profile/completion-actions";
import {getAppOrigin} from "@/lib/env";

export async function POST(request: Request) {
  const headers = {"Cache-Control":"private, no-store"};
  let origin: string;
  try { origin = getAppOrigin(); } catch { return new Response(null,{status:403,headers}); }
  if (request.headers.get("origin") !== origin) return new Response(null,{status:403,headers});
  return Response.json({show:await claimProfileCompletionNotice()},{headers});
}
