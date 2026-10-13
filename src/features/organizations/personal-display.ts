import type { Locale } from "@/lib/preferences";

export function formatPersonalDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", {
    dateStyle: "medium",
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

export function formatPersonalNumber(value: number | string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", {
    numberingSystem: "latn",
    maximumFractionDigits: 2,
  }).format(Number(value));
}
