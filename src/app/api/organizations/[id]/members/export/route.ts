import { getVerifiedUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin, getAuthConfig } from "@/lib/env";
import { z } from "zod";

const input = z.object({ q: z.string().trim().max(120), status: z.enum(["all", "Active", "Ended", "Inactive"]),
  term: z.uuid().nullable().optional(), committee: z.uuid().nullable(), locale: z.enum(["ar", "en"]) });
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (status: number) => Response.json({ error: "Export unavailable" }, { status, headers });

export async function POST(request: Request, context: RouteContext<"/api/organizations/[id]/members/export">) {
  let origin: string;
  try { origin = getAppOrigin(); } catch { return fail(503); }
  if (request.headers.get("origin") !== origin) return fail(403);
  const user = await getVerifiedUser();
  if (!user) return fail(401);
  const org = z.uuid().safeParse((await context.params).id);
  if (!org.success) return fail(400);
  const config = getAuthConfig();
  if (!config) return fail(503);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return fail(413);
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return fail(413);
    raw = JSON.parse(text);
  } catch { return fail(400); }
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(400);
  try {
    const { data: { session } } = await (await createClient()).auth.getSession();
    if (!session || session.user.id !== user.id) return fail(401);
    const { q, status, committee, term, locale } = parsed.data;
    const response = await fetch(`${config.url}/functions/v1/export-members`, {
      method: "POST", headers: { authorization: `Bearer ${session.access_token}`, apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ org: org.data, q, state: status, committee, term: term ?? null, locale }),
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return fail([400, 401, 403, 413, 422, 503].includes(response.status) ? response.status : 502);
    return new Response(response.body, { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": response.headers.get("Content-Disposition") ?? 'attachment; filename="members.xlsx"' } });
  } catch { return fail(502); }
}
