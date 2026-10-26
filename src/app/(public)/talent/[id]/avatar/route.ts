import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { createClient } from "@/lib/supabase/server";

// Recheck publication on every request, including conditional image requests.
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const failure = (status: number) => new Response(null, {status, headers: {"Cache-Control": "no-store"}});
  if (!z.uuid().safeParse(id).success) return failure(404);
  try {
    const rows=await getDb().execute(sql`select object_key,version from lub.public_talent_avatar(${id}::uuid)`);
    const asset=rows[0];
    if (!asset?.version || !asset.object_key) return failure(404);
    const version=String(asset.version);
    const headers = {"Content-Type": "image/webp", "Cache-Control": "private, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", ETag: `"${encodeURIComponent(version)}"`};
    if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, {status: 304, headers});
    const {data, error} = await (await createClient()).storage.from("lub-avatars").download(String(asset.object_key));
    if (error || !data) return failure(404);
    return new Response(data, {headers});
  } catch { return failure(503); }
}
