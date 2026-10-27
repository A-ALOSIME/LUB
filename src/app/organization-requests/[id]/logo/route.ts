import { z } from "zod";
import { sql } from "drizzle-orm";
import { withUser, withVisitor } from "@/db/client";
import { getVerifiedUser } from "@/features/auth/session";
import { inspectAvatar } from "@/features/profile/avatar-file";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404 });
  try {
    const user = await getVerifiedUser();
    const read = async (tx: Parameters<Parameters<typeof withUser>[1]>[0]) => {
      const [row] = await tx.execute(
        sql`select lub.organization_request_logo(${id.data}) as logo`,
      );
      return typeof row?.logo === "string" ? row.logo : null;
    };
    const value = user
      ? await withUser(user.id, read)
      : await withVisitor(read);
    if (!value) return new Response(null, { status: 404 });
    const bytes = Buffer.from(value, "base64");
    inspectAvatar(bytes, "image/webp");
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
