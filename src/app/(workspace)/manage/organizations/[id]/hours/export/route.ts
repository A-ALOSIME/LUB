import { sql } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/db/client";
import { getVerifiedUser } from "@/features/auth/session";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const optionalUuid = z.uuid().nullable();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getVerifiedUser();
  if (!user) return new Response(null, { status: 401, headers: privateHeaders });

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = z.object({
    organization: z.uuid(),
    committee: optionalUuid,
    term: optionalUuid,
  }).safeParse({
    organization: id,
    committee: url.searchParams.get("committee") || null,
    term: url.searchParams.get("term") || null,
  });
  if (!parsed.success) return new Response(null, { status: 400, headers: privateHeaders });

  try {
    const { organization, committee, term } = parsed.data;
    const rows = await withUser(user.id, tx => tx.execute(sql`
      select lub.export_hours_csv(${organization}, ${committee}::uuid, ${term}::uuid) as csv
    `));
    const csv = rows[0]?.csv;
    if (typeof csv !== "string") return new Response(null, { status: 404, headers: privateHeaders });

    return new Response(`\uFEFF${csv}`, {
      headers: {
        ...privateHeaders,
        "Content-Disposition": "attachment; filename=hours.csv",
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return new Response(null, { status: code === "42501" ? 403 : 503, headers: privateHeaders });
  }
}