import { bindings, defineConfig, defineWorker } from "cf/config";
import { loadEnv } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const envDir = process.env.LUB_ENV_DIR ?? process.cwd();
const ragEnvFile = resolve(envDir, "lub-connection.env");
const ragEnv = existsSync(ragEnvFile) ? parseEnv(readFileSync(ragEnvFile, "utf8")) : {};
const viteEnv = loadEnv("production", envDir, ["NEXT_PUBLIC_", "RAG_API_URL", "RAG_SITE_URL"]);

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? viteEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? viteEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  RAG_API_URL: process.env.RAG_API_URL ?? viteEnv.RAG_API_URL ?? ragEnv.RAG_API_URL,
  RAG_SITE_URL: process.env.RAG_SITE_URL ?? viteEnv.RAG_SITE_URL ?? ragEnv.RAG_SITE_URL,
};

export default defineConfig({
  worker: defineWorker({
    name: "lub-community",
    domains: ["lub.community"],
    entrypoint: "src/worker-entry.js",
    compatibilityDate: "2026-09-30",
    compatibilityFlags: ["nodejs_compat"],
    placement: { mode: "smart" },
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      APP_URL: bindings.text("https://lub.community/"),
      DATABASE_URL: bindings.secret(),
      HYPERDRIVE: bindings.hyperdrive({ id: "647cbdf1c164469bb75513d9e1c7f3e2" }),
      VINEXT_KV_CACHE: bindings.kv({ id: "21056f9634e3420b807b2008752c5481" }),
      IDENTIFIER_ENCRYPTION_KEY: bindings.secret(),
      IDENTIFIER_LOOKUP_KEY: bindings.secret(),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text(publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text(publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""),
      RAG_API_URL: bindings.text(publicEnv.RAG_API_URL ?? ""),
      RAG_API_TOKEN: bindings.secret(),
      RAG_SITE_URL: bindings.text(publicEnv.RAG_SITE_URL ?? "https://lub.community"),
    },
  }),
});
