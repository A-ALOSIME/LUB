import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function accountAvatarUrl(userId: string) {
  try {
    const bucket = (await createClient()).storage.from("lub-avatars");
    const {data, error} = await bucket.list(userId, {limit: 1, search: "avatar.webp"});
    if (error) return undefined;
    const file = data?.find(item => item.name === "avatar.webp");
    return file ? `/account/avatar?v=${encodeURIComponent(file.updated_at ?? file.id ?? "current")}` : undefined;
  } catch { return undefined; }
}

export async function storeAccountAvatar(userId: string, action: "replace" | "remove", bytes?: Uint8Array) {
  const bucket = (await createClient()).storage.from("lub-avatars");
  const key = `${userId}/avatar.webp`;
  const {error} = action === "remove" ? await bucket.remove([key]) : await bucket.upload(key, bytes!, {upsert:true, contentType:"image/webp", cacheControl:"3600"});
  if (error) throw new Error("Avatar storage unavailable");
}
