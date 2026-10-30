import {t as translateUi} from "@/lib/i18n";
import type { Locale } from "./preferences";

const TIME_ZONE = "Asia/Riyadh";
const AR_LOCALE = "ar-SA-u-nu-latn";
const EN_LOCALE = "en-GB-u-nu-latn";
// Six immutable locale/format combinations; never cache dates or user data.
const formatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(locale: Locale, includeWeekday: boolean) {
  const language = locale === "en" ? EN_LOCALE : AR_LOCALE;
  const key = `${language}:${includeWeekday ? "weekday" : "date"}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, {weekday: includeWeekday ? "long" : undefined,day:"numeric",month:"long",year:"numeric",calendar:"gregory",timeZone:TIME_ZONE});
    formatters.set(key, formatter);
  }
  return formatter;
}
function timeFormatter(locale: Locale) {
  const language = locale === "en" ? EN_LOCALE : AR_LOCALE;
  const key = `${language}:time`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, {hour:"numeric",minute:"2-digit",hourCycle:"h12",timeZone:TIME_ZONE});
    formatters.set(key, formatter);
  }
  return formatter;
}

function parseRiyadhValue(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const normalized = value.trim();
  if (!normalized) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized);
  const parsed = new Date(dateOnly ? `${normalized}T12:00:00+03:00` : localDateTime ? `${normalized}+03:00` : normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRiyadhDate(value: string | Date | null | undefined, locale: Locale = "ar", includeWeekday = false) {
  const date = parseRiyadhValue(value);
  if (!date) return translateUi((locale === "en") ? "en" : "ar", "غير محدد", "Not set");
  return dateFormatter(locale, includeWeekday).format(date);
}

export function formatRiyadhTime(value: string | Date | null | undefined, locale: Locale = "ar") {
  const date = parseRiyadhValue(value);
  if (!date) return translateUi((locale === "en") ? "en" : "ar", "غير محدد", "Not set");
  return timeFormatter(locale).format(date);
}

export function formatRiyadhDateTime(value: string | Date | null | undefined, locale: Locale = "ar", includeWeekday = false) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return formatRiyadhDate(value, locale, includeWeekday);
  const date = parseRiyadhValue(value);
  if (!date) return translateUi((locale === "en") ? "en" : "ar", "غير محدد", "Not set");
  const formattedDate = dateFormatter(locale, includeWeekday).format(date);
  return `${formattedDate}${translateUi((locale === "en") ? "en" : "ar", "، ", ", ")}${formatRiyadhTime(date, locale)}`;
}
