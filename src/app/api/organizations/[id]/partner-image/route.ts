import { z } from "zod";
import { getVerifiedUser } from "@/features/auth/session";
import { getAccountStatus } from "@/features/profile/repository";
import { inspectOrganizationLogo, ORGANIZATION_LOGO_MAX_BYTES } from "@/features/organizations/logo-file";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";

const bucketName = "lub-organization-logos";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
type RouteContext = { params: Promise<{ id: string }> };

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: privateHeaders });
}

function sameOrigin(request: Request) {
  try { return request.headers.get("origin") === getAppOrigin(); }
  catch { return false; }
}

async function boundedForm(request: Request) {
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
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return { form: await new Request(request.url, { method: "POST", headers, body: bytes }).formData(), tooLarge: false };
}

export async function POST(request: Request, context: RouteContext) {
  if (!sameOrigin(request)) return jsonError(403, "forbidden");
  const user = await getVerifiedUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    if (await getAccountStatus(user.id) !== "Active") return jsonError(403, "forbidden");
  } catch { return jsonError(503, "storage-unavailable"); }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "not-found");
  if (Number(request.headers.get("content-length") ?? 0) > ORGANIZATION_LOGO_MAX_BYTES + 128_000) return jsonError(413, "too-large");

  let file: File;
  try {
    const { form, tooLarge } = await boundedForm(request);
    if (tooLarge) return jsonError(413, "too-large");
    const entry = form?.get("file");
    if (!(entry instanceof File) || !entry.size) return jsonError(400, "invalid-file");
    if (entry.size > ORGANIZATION_LOGO_MAX_BYTES) return jsonError(413, "too-large");
    file = entry;
  } catch { return jsonError(400, "invalid-file"); }

  let inspected: ReturnType<typeof inspectOrganizationLogo>;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    inspected = inspectOrganizationLogo(bytes);
  } catch { return jsonError(400, "invalid-file"); }

  let client: Awaited<ReturnType<typeof createClient>>;
  try { client = await createClient(); }
  catch { return jsonError(503, "storage-unavailable"); }
  const objectPath = `organizations/${id}/${crypto.randomUUID()}.${inspected.extension}`;
  try {
    const { error } = await client.storage.from(bucketName).upload(objectPath, bytes, { contentType: inspected.mimeType, cacheControl: "31536000", upsert: false });
    if (error) return jsonError(error.statusCode === "403" ? 403 : 503, error.statusCode === "403" ? "forbidden" : "storage-unavailable");
  } catch { return jsonError(503, "storage-unavailable"); }

  const url = client.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;
  return Response.json({ url }, { headers: privateHeaders });
}
