import { getVerifiedUser } from "@/features/auth/session";

export async function GET() {
  const user = await getVerifiedUser();
  return new Response(null, {
    status: user ? 410 : 401,
    headers: { "Cache-Control": "private, no-store" },
  });
}
