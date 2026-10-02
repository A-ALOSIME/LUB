import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthConfig } from "@/lib/env";

export async function createClient(writable = false) {
  const config = getAuthConfig();
  if (!config) throw new Error("Supabase Auth is not configured.");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (updates) => {
        // Proxy owns cookie refresh during Server Component rendering.
        if (!writable) return;
        for (const { name, value, options } of updates) {
          store.set(name, value, options);
        }
      },
    },
  });
}
