import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rootCertificates } from "node:tls";

export function databaseTLS(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("PostgreSQL connection required."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("PostgreSQL connection required.");
  if (["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) return false;
  const projectCA = process.env.LUB_SUPABASE_CA_CERT ?? readFileSync(join(process.cwd(), "config", "supabase-prod-ca-2021.crt"), "utf8");
  return { rejectUnauthorized: true, ca: [...(Array.isArray(rootCertificates) ? rootCertificates : []), projectCA] };
}
