import "server-only";
import {cache} from "react";
import { cookies } from "next/headers";

export type Locale = "ar" | "en";
export type Theme = "light" | "dark";

export const getPreferences=cache(async(): Promise<{ locale: Locale; theme: Theme }> => {
  const jar = await cookies();
  return {
    locale: jar.get("lub-locale")?.value === "en" ? "en" : "ar",
    theme: jar.get("lub-theme")?.value === "light" ? "light" : "dark",
  };
});
