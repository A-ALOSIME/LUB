import { z } from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import { privateEventPoster,publicEventPoster } from "@/features/events/workspace";
import { createClient } from "@/lib/supabase/server";

const headers = {
  "Cache-Control": "private, max-age=0, must-revalidate",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404, headers });

  try {
    let poster = await publicEventPoster(id);
    let privatePoster=false;
    if(!poster){const user=await getVerifiedUser();if(user){poster=await privateEventPoster(user.id,id);privatePoster=!!poster;}}
    if (!poster || !["image/jpeg", "image/png"].includes(poster.mime_type)) return new Response(null, { status: 404, headers });
    const { data, error } = await (await createClient()).storage.from("lub-application-files").download(poster.object_key);
    if (error || !data) return new Response(null, { status: 404, headers });
    // Keep image delivery same-origin so the document CSP remains restrictive.
    return new Response(data, { headers: { ...headers,...(privatePoster?{"Cache-Control":"private, no-store"}:{}), "Content-Type":poster.mime_type,"Cross-Origin-Resource-Policy":"same-origin" } });
  } catch {
    return new Response(null, { status: 404, headers: { ...headers, "Cache-Control": "private, no-store" } });
  }
}
