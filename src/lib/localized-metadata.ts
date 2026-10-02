import type { Metadata } from "next";
import { getPreferences } from "./preferences";

export async function localizedMetadata(ar: string, en: string, rest: Metadata = {}): Promise<Metadata> {
  const { locale } = await getPreferences();
  return { ...rest, title: locale === "en" ? en : ar };
}
