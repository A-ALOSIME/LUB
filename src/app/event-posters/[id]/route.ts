import { z } from "zod";
import { publicEventPoster } from "@/features/events/workspace";
import { createClient } from "@/lib/supabase/server";

const headers = {
  "Cache-Control": "public, max-age=0, s-maxage=240",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404, headers });

  try {
    const poster = await publicEventPoster(id);
    if (!poster || !["image/jpeg", "image/png"].includes(poster.mime_type)) return new Response(null, { status: 404, headers });
    const { data, error } = await (await createClient()).storage.from("lub-application-files").createSignedUrl(poster.object_key, 300);
    if (error || !data.signedUrl) return new Response(null, { status: 404, headers });
    return new Response(null, { status: 302, headers: { ...headers, Location: data.signedUrl } });
  } catch {
    return new Response(null, { status: 404, headers: { ...headers, "Cache-Control": "private, no-store" } });
  }
}
