import { sql } from "drizzle-orm";
import { z } from "zod";
import { withVisitor } from "@/db/client";
import { createClient } from "@/lib/supabase/server";

// Recheck publication on every request, including conditional image requests.
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const failure = (status: number) => new Response(null, {status, headers: {"Cache-Control": "no-store"}});
  if (!z.uuid().safeParse(id).success) return failure(404);
  try {
    const version = await withVisitor(async tx => {
      const rows = await tx.execute(sql`select lub.public_avatar_version(${id}::uuid) as version`);
      return rows[0]?.version as string | null;
    });
    if (!version) return failure(404);
    const headers = {"Content-Type": "image/webp", "Cache-Control": "private, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", ETag: `"${encodeURIComponent(version)}"`};
    if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, {status: 304, headers});
    const {data, error} = await (await createClient()).storage.from("lub-avatars").download(`${id}/avatar.webp`);
    if (error || !data) return failure(404);
    return new Response(data, {headers});
  } catch { return failure(503); }
}
