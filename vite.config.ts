import { defineConfig, loadEnv } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { readFileSync } from "node:fs";

// Next's standalone output is for the Docker/Node build, not Cloudflare Workers.
process.env.LUB_VINEXT_BUILD = "true";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.env.LUB_ENV_DIR ?? process.cwd(), "NEXT_PUBLIC_"), ...process.env };
  const publicValues = {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""),
    "process.env.LUB_SUPABASE_CA_CERT": JSON.stringify(readFileSync(new URL("./config/supabase-prod-ca-2021.crt", import.meta.url), "utf8")),
  };

  if (mode === "production" && Object.values(publicValues).some((value) => value === '""')) {
    throw new Error("Cloudflare production build needs the public Supabase URL and publishable key.");
  }

  return {
    define: publicValues,
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
    ],
  };
});
