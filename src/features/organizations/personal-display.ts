import type { Locale } from "@/lib/preferences";
import { formatRiyadhDate } from "@/lib/datetime";

export function formatPersonalDate(value: string, locale: Locale) {
  return formatRiyadhDate(value, locale);
}

export function formatPersonalNumber(value: number | string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", {
    numberingSystem: "latn",
    maximumFractionDigits: 2,
  }).format(Number(value));
}
