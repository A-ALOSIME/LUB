export function getAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
    return { url, key };
  } catch {
    return null;
  }
}

export function isProfileStorageConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.IDENTIFIER_ENCRYPTION_KEY && process.env.IDENTIFIER_LOOKUP_KEY);
}

export function getAppOrigin() {
  try {
    const url = new URL(process.env.APP_URL ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new Error("Application origin is not configured."); }
}
