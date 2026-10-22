import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { getVerifiedUser } from "@/features/auth/session";
import { getAccountStatus } from "@/features/profile/repository";
import { saveOrganizationLogo } from "@/features/organizations/management-repository";
import { inspectOrganizationLogo, ORGANIZATION_LOGO_MAX_BYTES } from "@/features/organizations/logo-file";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin, getAuthConfig } from "@/lib/env";

const bucketName = "lub-organization-logos";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
type RouteContext = { params: Promise<{ id: string }> };

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: privateHeaders });
}

function hasSameOrigin(request: Request) {
  try { return request.headers.get("origin") === getAppOrigin(); }
  catch { return false; }
}

function previousObjectPath(logoUrl: string, organizationId: string) {
  const config = getAuthConfig();
  if (!config) return undefined;
  const prefix = `${config.url.replace(/\/$/, "")}/storage/v1/object/public/${bucketName}/`;
  if (!logoUrl.startsWith(prefix)) return undefined;
  try {
    const path = decodeURIComponent(logoUrl.slice(prefix.length));
    return new RegExp(`^organizations/${organizationId}/[0-9a-f-]{36}\\.(?:png|svg)$`, "i").test(path) ? path : undefined;
  } catch { return undefined; }
}

async function removeOldLogo(client: Awaited<ReturnType<typeof createClient>>, logoUrl: string, organizationId: string) {
  const objectPath = previousObjectPath(logoUrl, organizationId);
  if (!objectPath) return;
  await client.storage.from(bucketName).remove([objectPath]).catch(() => undefined);
}

async function readBoundedForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return { form: undefined, tooLarge: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  const limit = ORGANIZATION_LOGO_MAX_BYTES + 128_000;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { form: undefined, tooLarge: true };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const boundedRequest = new Request(request.url, { method: "POST", headers, body });
  return { form: await boundedRequest.formData(), tooLarge: false };
}

function revalidateOrganization(id: string, slug: string) {
  revalidateTag("public-organizations", { expire: 0 });
  revalidatePath("/organizations", "layout");
  revalidatePath(`/organizations/${slug}`);
  revalidatePath(`/manage/organizations/${id}`);
}

async function authorize(request: Request, context: RouteContext) {
  if (!hasSameOrigin(request)) return { error: jsonError(403, "forbidden") };
  const user = await getVerifiedUser();
  if (!user) return { error: jsonError(401, "unauthorized") };
  try {
    if (await getAccountStatus(user.id) !== "Active") return { error: jsonError(403, "forbidden") };
  } catch { return { error: jsonError(503, "storage-unavailable") }; }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return { error: jsonError(404, "not-found") };
  return { user, id };
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorize(request, context);
  if ("error" in auth) return auth.error;
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > ORGANIZATION_LOGO_MAX_BYTES + 128_000) return jsonError(413, "too-large");

  let file: File;
  try {
    const { form, tooLarge } = await readBoundedForm(request);
    if (tooLarge) return jsonError(413, "too-large");
    if (!form) return jsonError(400, "invalid-file");
    const entry = form.get("file");
    if (!(entry instanceof File) || !entry.size) return jsonError(400, "invalid-file");
    if (entry.size > ORGANIZATION_LOGO_MAX_BYTES) return jsonError(413, "too-large");
    file = entry;
  } catch { return jsonError(400, "invalid-file"); }

  let inspected: ReturnType<typeof inspectOrganizationLogo>;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    inspected = inspectOrganizationLogo(bytes);
  } catch {
    return jsonError(400, "invalid-file");
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch { return jsonError(503, "storage-unavailable"); }
  const objectPath = `organizations/${auth.id}/${crypto.randomUUID()}.${inspected.extension}`;
  let uploadError: { statusCode?: string } | null;
  try {
    ({ error: uploadError } = await supabase.storage.from(bucketName).upload(objectPath, bytes, {
      contentType: inspected.mimeType,
      cacheControl: "31536000",
      upsert: false,
    }));
  } catch { return jsonError(503, "storage-unavailable"); }
  if (uploadError) {
    const status = "statusCode" in uploadError && String(uploadError.statusCode) === "403" ? 403 : 400;
    return jsonError(status === 403 ? status : 503, status === 403 ? "forbidden" : "storage-unavailable");
  }

  const newLogoUrl = supabase.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;
  let saved: Awaited<ReturnType<typeof saveOrganizationLogo>>;
  try {
    saved = await saveOrganizationLogo(auth.user.id, auth.id, newLogoUrl);
  } catch (error) {
    await supabase.storage.from(bucketName).remove([objectPath]).catch(() => undefined);
    return jsonError(error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500, "save-failed");
  }
  await removeOldLogo(supabase, saved.previousLogoUrl, auth.id);
  revalidateOrganization(auth.id, saved.slug);
  return Response.json({ ok: true }, { headers: privateHeaders });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorize(request, context);
  if ("error" in auth) return auth.error;
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch { return jsonError(503, "storage-unavailable"); }
  let saved: Awaited<ReturnType<typeof saveOrganizationLogo>>;
  try {
    saved = await saveOrganizationLogo(auth.user.id, auth.id, "");
  } catch (error) {
    return jsonError(error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500, "save-failed");
  }
  await removeOldLogo(supabase, saved.previousLogoUrl, auth.id);
  revalidateOrganization(auth.id, saved.slug);
  return Response.json({ ok: true }, { headers: privateHeaders });
}
