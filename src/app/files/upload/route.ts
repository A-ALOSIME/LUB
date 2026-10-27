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

function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  let appOrigin: string;
  try {
    appOrigin = getAppOrigin();
  } catch {
    return failure(503, "upload_unavailable");
  }
  if (request.headers.get("origin") !== appOrigin) return failure(403, "origin_not_allowed");

  const user = await getVerifiedUser();
  if (!user) return failure(401, "session_required");

  const purpose = request.nextUrl.searchParams.get("purpose");
  if (purpose && !["event-poster","task-image","announcement-image"].includes(purpose)) return failure(400, "unsupported_upload_purpose");
  if (!purpose && await isSuperAdminUser(user.id)) return failure(403, "upload_not_allowed");
  if (Number(request.headers.get("content-length") ?? 0) > maxFileSize + 1024 * 1024) {
    return failure(413, "file_too_large");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure(400, "invalid_upload");
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || !file.name || file.name.length > 120 || /[\x00-\x1f/\\]/.test(file.name)) {
    return failure(400, "invalid_file");
  }
  if (file.size > maxFileSize) return failure(413, "file_too_large");
  if(purpose && !["image/jpeg","image/png","application/octet-stream", ""].includes(file.type)) return failure(400,"unsupported_poster_type");

  if (purpose) {
    const organization = z.uuid().safeParse(form.get("organization"));
    if (!organization.success) return failure(400, "invalid_organization");
    try {
      const access = await withUser(user.id, tx => tx.execute(sql`
        select lub.has_org_permission(${organization.data}, ${purpose==="task-image"?"TASKS_MANAGE":purpose==="announcement-image"?"ORG_PROFILE_MANAGE":"EVENTS_MANAGE"},${purpose==="task-image"?z.uuid().nullable().parse(form.get("committee")||null):null}::uuid) as allowed
      `));
      if (!access[0]?.allowed) return failure(403, "organization_permission_required");
    } catch {
      console.error("File upload authorization check failed.");
      return failure(503, "authorization_unavailable");
    }
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return failure(400, "invalid_file");
  }
  let mime: string;
  try {
    mime = inspectAttachment(bytes, file.type);
  } catch {
    return failure(400, "invalid_file");
  }
  if (purpose && mime !== "image/jpeg" && mime !== "image/png") {
    return failure(400, "unsupported_poster_type");
  }

  const id = randomUUID();
  const key = `${user.id}/${id}`;
  let removeUploadedObject: (() => Promise<unknown>) | undefined;
  try {
    const bucket = (await createClient()).storage.from("lub-application-files");
    const { error } = await bucket.upload(key, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.error("File upload storage step failed.");
      return failure(503, "storage_unavailable");
    }
    removeUploadedObject = () => bucket.remove([key]);
  } catch {
    console.error("File upload storage step failed.");
    return failure(503, "storage_unavailable");
  }

  try {
    await withUser(user.id, tx => tx.execute(sql`
      select lub.register_application_asset(${id}, ${key}, ${file.name}, ${mime}, ${file.size})
    `));
  } catch {
    try { await removeUploadedObject?.(); } catch { /* Keep the response safe if cleanup also fails. */ }
    console.error("File upload registration step failed.");
    return failure(503, "asset_registration_unavailable");
  }

  return NextResponse.json({ id, name: file.name }, { headers: privateHeaders });
}
