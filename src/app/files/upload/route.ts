import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getVerifiedUser } from "@/features/auth/session";
import { inspectAttachment } from "@/features/forms/files";
import { withUser } from "@/db/client";
import { getAppOrigin } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const maxFileSize = 5 * 1024 * 1024;
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== getAppOrigin()) return new NextResponse(null, { status: 403 });

  const user = await getVerifiedUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const purpose = request.nextUrl.searchParams.get("purpose");
  if (purpose && purpose !== "event-poster") return new NextResponse(null, { status: 400 });
  if (!purpose && await isSuperAdminUser(user.id)) return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > maxFileSize + 1024 * 1024) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > maxFileSize || !file.name || file.name.length > 120 || /[\x00-\x1f/\\]/.test(file.name)) {
      throw new Error("Invalid upload");
    }

    if (purpose) {
      const organization = z.uuid().safeParse(form.get("organization"));
      if (!organization.success) {
        return NextResponse.json({ error: "الجهة غير صالحة." }, { status: 400, headers: privateHeaders });
      }
      const access = await withUser(user.id, tx => tx.execute(sql`
        select lub.has_org_permission(${organization.data}, 'EVENTS_MANAGE') as allowed
      `));
      if (!access[0]?.allowed) return new NextResponse(null, { status: 403, headers: privateHeaders });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = inspectAttachment(bytes, file.type);
    if (purpose && mime !== "image/jpeg" && mime !== "image/png") throw new Error("Invalid poster type");

    const id = randomUUID();
    const key = `${user.id}/${id}`;
    const bucket = (await createClient()).storage.from("lub-application-files");
    const { error } = await bucket.upload(key, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error("Storage upload failed");

    try {
      await withUser(user.id, tx => tx.execute(sql`
        select lub.register_application_asset(${id}, ${key}, ${file.name}, ${mime}, ${file.size})
      `));
    } catch {
      await bucket.remove([key]);
      throw new Error("Asset registration failed");
    }

    return NextResponse.json({ id, name: file.name }, { headers: privateHeaders });
  } catch {
    const message = purpose
      ? "تعذّر رفع البوستر. استخدم صورة JPEG أو PNG حتى 5 ميجابايت."
      : "تعذّر رفع الملف. اختر PDF أو JPEG أو PNG حتى 5 ميجابايت.";
    return NextResponse.json({ error: message }, { status: 400, headers: privateHeaders });
  }
}
