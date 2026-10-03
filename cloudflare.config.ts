import { bindings, defineConfig, defineWorker } from "cf/config";
import { loadEnv } from "vite";

const publicEnv = { ...loadEnv("production", process.env.LUB_ENV_DIR ?? process.cwd(), ["NEXT_PUBLIC_", "RAG_API_URL", "RAG_SITE_URL"]), ...process.env };

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
      APP_URL: bindings.text("https://lub.community"),
      DATABASE_URL: bindings.secret(),
      HYPERDRIVE: bindings.hyperdrive({ id: "647cbdf1c164469bb75513d9e1c7f3e2" }),
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
