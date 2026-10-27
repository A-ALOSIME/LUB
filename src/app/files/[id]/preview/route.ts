import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getVerifiedUser } from "@/features/auth/session";
import { withUser } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { inspectAttachment } from "@/features/forms/files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getVerifiedUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse(null, { status: 404 });
  try {
    const rows = await withUser(user.id, (tx) =>
      tx.execute(
        sql`select object_key,mime_type,size_bytes from lub.application_assets where id=${id}`,
      ),
    );
    const asset = rows[0];
    if (
      !asset ||
      !["image/png", "image/jpeg"].includes(String(asset.mime_type))
    )
      return new NextResponse(null, { status: 404 });
    const client = await createClient();
    const { data, error } = await client.storage
      .from("lub-application-files")
      .download(String(asset.object_key));
    if (
      error ||
      !data ||
      data.size !== Number(asset.size_bytes) ||
      data.size > 5 * 1024 * 1024
    )
      throw new Error("Image unavailable");
    const bytes = new Uint8Array(await data.arrayBuffer());
    inspectAttachment(bytes, String(asset.mime_type));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": String(asset.mime_type),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
