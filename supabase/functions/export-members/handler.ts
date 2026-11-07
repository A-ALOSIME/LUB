import { membersXlsx, exportFilename, type MemberExportRecord } from "./xlsx.ts";

type Dependencies = { env: (key: string) => string | undefined; fetcher: typeof fetch };
const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function createMemberExportHandler({ env, fetcher }: Dependencies) {
  return async (request: Request) => {
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    const fail = (status: number) => Response.json({ error: "Export unavailable" }, { status, headers });
    if (request.method !== "POST") return fail(405);
    const auth = request.headers.get("authorization"), url = env("SUPABASE_URL"), apiKey = env("SUPABASE_ANON_KEY");
    if (!auth?.startsWith("Bearer ") || !url || !apiKey) return fail(401);
    try {
      const identity = await fetcher(`${url}/auth/v1/user`, { headers: { authorization: auth, apikey: apiKey }, signal: AbortSignal.timeout(10000) });
      if (!identity.ok || typeof (await identity.json())?.id !== "string") return fail(401);
      if (Number(request.headers.get("content-length") ?? 0) > 2048) return fail(413);
      const text = await request.text();
      if (text.length > 2048) return fail(413);
      let input;
      try { input = JSON.parse(text); } catch { return fail(400); }
      if (!input || !uuid(input.org) || typeof input.q !== "string" || input.q.length > 120
        || !["all", "Active", "Ended", "Inactive"].includes(input.state) || !(input.committee === null || uuid(input.committee))
        || (input.term != null && !uuid(input.term)) || !["ar", "en"].includes(input.locale)) return fail(400);
      const secret = env("IDENTIFIER_ENCRYPTION_KEY");
      if (!secret) return fail(503);
      const response = await fetcher(`${url}/rest/v1/rpc/export_member_rows`, {
        method: "POST", headers: { authorization: auth, apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ org: input.org, q: input.q, state: input.state, committee: input.committee, term: input.term ?? null }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const issue = await response.json();
        return fail(issue?.code === "42501" ? 403 : issue?.code === "54000" && issue?.message === "Refine export filters" ? 422 : 502);
      }
      const data: { records: MemberExportRecord[]; slug: string; filter: string } = await response.json();
      if (!Array.isArray(data?.records) || data.records.length > 500 || typeof data.slug !== "string" || typeof data.filter !== "string") return fail(502);
      const bytes = await membersXlsx(data.records, secret, input.locale);
      return new Response(bytes, { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename(data.slug, data.filter)}"` } });
    } catch { return fail(502); }
  };
}
