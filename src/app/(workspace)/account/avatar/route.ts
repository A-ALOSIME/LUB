import { getVerifiedUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return new Response(null, {status:401, headers:{"Cache-Control":"no-store"}});
  try {
    const {data, error} = await (await createClient()).storage.from("lub-avatars").download(`${user.id}/avatar.webp`);
    if (error || !data) return new Response(null, {status:404,headers:{"Cache-Control":"no-store"}});
    return new Response(data, {headers:{"Content-Type":"image/webp","Cache-Control":"private, max-age=3600, must-revalidate","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"}});
  } catch { return new Response(null, {status:503,headers:{"Cache-Control":"no-store"}}); }
}
